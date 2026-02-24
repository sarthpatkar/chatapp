package com.chatbot.service;

import com.chatbot.entity.ChatMessage;
import com.chatbot.repository.ChatMessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class AiService {

    private static final Logger logger = LoggerFactory.getLogger(AiService.class);
    private static final String API_ROOT =
            "https://generativelanguage.googleapis.com/v1beta/models/";
    private static final List<String> FALLBACK_MODELS = List.of(
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-1.5-flash-latest",
            "gemini-1.5-flash",
            "gemini-pro"
    );

    private final ChatMessageRepository chatRepository;
    private final FinanceDomainService financeDomainService;

    public AiService(
            ChatMessageRepository chatRepository,
            FinanceDomainService financeDomainService) {
        this.chatRepository = chatRepository;
        this.financeDomainService = financeDomainService;
    }

    @Value("${google.api.key:}")
    private String apiKey;

    @Value("${google.api.model:gemini-2.0-flash}")
    private String configuredModel;

    public String getAiResponse(String message) {

        if (message == null || message.trim().isEmpty()) {
            return "Please type something.";
        }
        String scopeViolation = financeDomainService.validateScope(message);
        if (scopeViolation != null) {
            return scopeViolation;
        }

        String sanitizedKey = sanitizeApiKey(apiKey);
        if (sanitizedKey.isEmpty()) {
            logger.error("google.api.key is missing. Set GOOGLE_API_KEY in backend/.env.");
            return "AI service is not configured on server. Please set GOOGLE_API_KEY.";
        }

        RestTemplate restTemplate = buildRestTemplate();
        HttpEntity<Map<String, Object>> entity = buildGeminiRequest(message);

        LinkedHashSet<String> modelsToTry = new LinkedHashSet<>();
        if (configuredModel != null && !configuredModel.isBlank()) {
            modelsToTry.add(configuredModel.trim());
        }
        modelsToTry.addAll(FALLBACK_MODELS);

        String lastTransientIssue = null;
        for (String model : modelsToTry) {
            GeminiAttemptResult result = requestGemini(restTemplate, entity, model, sanitizedKey);
            if (result.responseText != null) {
                return result.responseText;
            }
            if (result.userFacingError != null) {
                return result.userFacingError;
            }
            if (result.transientIssue != null) {
                lastTransientIssue = result.transientIssue;
            }
        }

        if (lastTransientIssue != null) {
            logger.warn("All Gemini attempts failed. Last issue: {}", lastTransientIssue);
        }
        return "AI service is temporarily unavailable. Please try again.";
    }

    public List<ChatMessage> getChatHistory(Long userId) {
        return chatRepository.findByUserIdOrderByCreatedAtAsc(userId);
    }

    private HttpEntity<Map<String, Object>> buildGeminiRequest(String message) {
        Map<String, Object> part = new HashMap<>();
        part.put("text", financeDomainService.buildFinancePrompt(message));

        Map<String, Object> content = new HashMap<>();
        content.put("parts", Collections.singletonList(part));

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("contents", Collections.singletonList(content));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

        return new HttpEntity<>(requestBody, headers);
    }

    private GeminiAttemptResult requestGemini(
            RestTemplate restTemplate,
            HttpEntity<Map<String, Object>> entity,
            String model,
            String key) {

        String url = API_ROOT + model + ":generateContent?key=" + key;
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    Map.class
            );

            Map<?, ?> responseBody = response.getBody();
            if (responseBody == null) {
                logger.warn("Gemini returned empty body for model {}", model);
                return GeminiAttemptResult.transientFailure("empty response body");
            }

            String text = extractText(responseBody);
            if (text == null || text.isBlank()) {
                logger.warn("Gemini response had no text for model {}", model);
                return GeminiAttemptResult.transientFailure("no text in candidate");
            }
            return GeminiAttemptResult.success(text);

        } catch (HttpStatusCodeException ex) {
            int status = ex.getStatusCode().value();
            String body = ex.getResponseBodyAsString();
            String loweredBody = body == null ? "" : body.toLowerCase(Locale.ROOT);
            logger.warn(
                    "Gemini call failed for model {} with status {}: {}",
                    model,
                    status,
                    body
            );

            if (status == 404 || loweredBody.contains("model") && loweredBody.contains("not found")) {
                return GeminiAttemptResult.transientFailure("model not found: " + model);
            }
            if (status == 400 && (loweredBody.contains("api key not valid")
                    || loweredBody.contains("invalid api key")
                    || loweredBody.contains("api_key_invalid"))) {
                return GeminiAttemptResult.fatal(
                        "Invalid GOOGLE_API_KEY. Please update backend/.env with a valid key.");
            }
            if (status == 403 && (loweredBody.contains("has not been used")
                    || loweredBody.contains("not enabled"))) {
                return GeminiAttemptResult.fatal(
                        "Generative Language API is not enabled for this key/project.");
            }
            if (status == 429 || loweredBody.contains("quota")) {
                return GeminiAttemptResult.fatal(
                        "AI quota exceeded. Check Google API billing/quota for this key.");
            }
            if (status == 401 || status == 403) {
                return GeminiAttemptResult.fatal(
                        "Google API key is unauthorized for this request.");
            }

            return GeminiAttemptResult.transientFailure("HTTP " + status);
        } catch (RestClientException ex) {
            logger.warn("Gemini call failed for model {}: {}", model, ex.getMessage());
            return GeminiAttemptResult.transientFailure(ex.getMessage());
        }
    }

    private RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(30_000);
        return new RestTemplate(factory);
    }

    private String extractText(Map<?, ?> responseBody) {
        Object candidatesObj = responseBody.get("candidates");
        if (!(candidatesObj instanceof List<?> candidates) || candidates.isEmpty()) {
            return null;
        }

        Object candidateObj = candidates.get(0);
        if (!(candidateObj instanceof Map<?, ?> candidate)) {
            return null;
        }

        Object contentObj = candidate.get("content");
        if (!(contentObj instanceof Map<?, ?> content)) {
            return null;
        }

        Object partsObj = content.get("parts");
        if (!(partsObj instanceof List<?> parts) || parts.isEmpty()) {
            return null;
        }

        Object partObj = parts.get(0);
        if (!(partObj instanceof Map<?, ?> part)) {
            return null;
        }

        Object textObj = part.get("text");
        if (!(textObj instanceof String text) || text.isBlank()) {
            return null;
        }

        return text;
    }

    private String sanitizeApiKey(String key) {
        if (key == null) {
            return "";
        }

        String trimmed = key.trim();
        // Common typo: accidentally prepending a single extra character before "AIza..."
        if (trimmed.startsWith("yAIza")) {
            logger.warn("google.api.key looked malformed (yAIza...). Attempting automatic correction.");
            return trimmed.substring(1);
        }
        return trimmed;
    }

    private static class GeminiAttemptResult {
        private final String responseText;
        private final String userFacingError;
        private final String transientIssue;

        private GeminiAttemptResult(String responseText, String userFacingError, String transientIssue) {
            this.responseText = responseText;
            this.userFacingError = userFacingError;
            this.transientIssue = transientIssue;
        }

        private static GeminiAttemptResult success(String responseText) {
            return new GeminiAttemptResult(responseText, null, null);
        }

        private static GeminiAttemptResult fatal(String userFacingError) {
            return new GeminiAttemptResult(null, userFacingError, null);
        }

        private static GeminiAttemptResult transientFailure(String issue) {
            return new GeminiAttemptResult(null, null, issue);
        }
    }
}

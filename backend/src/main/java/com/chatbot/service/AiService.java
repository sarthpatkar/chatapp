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
    private static final String OPENROUTER_CHAT_URL =
            "https://openrouter.ai/api/v1/chat/completions";
    private static final int RATE_LIMIT_RETRY_ROUNDS = 2;
    private static final long RATE_LIMIT_BACKOFF_MS = 1200L;
    private static final List<String> FALLBACK_MODELS = List.of(
            "meta-llama/llama-3.3-70b-instruct:free",
            "google/gemma-3-27b-it:free",
            "qwen/qwen3-coder:free",
            "mistralai/mistral-small-3.1-24b-instruct:free",
            "openai/gpt-oss-120b:free",
            "openai/gpt-oss-20b:free"
    );

    private final ChatMessageRepository chatRepository;
    private final FinanceDomainService financeDomainService;

    public AiService(
            ChatMessageRepository chatRepository,
            FinanceDomainService financeDomainService) {
        this.chatRepository = chatRepository;
        this.financeDomainService = financeDomainService;
    }

    @Value("${openrouter.api.key:}")
    private String apiKey;

    @Value("${openrouter.api.model:meta-llama/llama-3.3-70b-instruct:free}")
    private String configuredModel;

    public String getAiResponse(String message) {
        return getAiReply(message).responseText();
    }

    public AiReply getAiReply(String message) {
        if (message == null || message.trim().isEmpty()) {
            return AiReply.of("Please type something.", "rule-engine");
        }
        String scopeViolation = financeDomainService.validateScope(message);
        if (scopeViolation != null) {
            return AiReply.of(scopeViolation, "rule-engine");
        }

        String sanitizedKey = sanitizeApiKey(apiKey);
        if (sanitizedKey.isEmpty()) {
            logger.error("openrouter.api.key is missing. Set OPENROUTER_API_KEY in backend/.env.");
            return AiReply.of("AI service is not configured on server. Please set OPENROUTER_API_KEY.",
                    "openrouter");
        }
        if (looksLikePlaceholder(sanitizedKey)) {
            logger.error("openrouter.api.key looks like a placeholder, not a real key.");
            return AiReply.of("OPENROUTER_API_KEY is not a real key. Update backend/.env and restart backend.",
                    "openrouter");
        }

        RestTemplate restTemplate = buildRestTemplate();
        LinkedHashSet<String> modelsToTry = new LinkedHashSet<>();
        if (configuredModel != null && !configuredModel.isBlank()) {
            String configured = configuredModel.trim();
            if (!configured.equalsIgnoreCase("openrouter/auto")) {
                modelsToTry.add(configured);
            }
        }
        modelsToTry.addAll(FALLBACK_MODELS);

        String lastTransientIssue = null;
        boolean sawRateLimit = false;
        for (int round = 1; round <= RATE_LIMIT_RETRY_ROUNDS; round++) {
            boolean roundSawRateLimit = false;
            for (String model : modelsToTry) {
                OpenRouterAttemptResult result = requestOpenRouter(restTemplate, message, model, sanitizedKey);
                if (result.responseText != null) {
                    return AiReply.of(result.responseText, result.modelUsed);
                }
                if (result.userFacingError != null) {
                    return AiReply.of(result.userFacingError,
                            result.modelUsed == null ? "unknown" : result.modelUsed);
                }
                if (result.transientIssue != null) {
                    lastTransientIssue = result.transientIssue;
                    if (isRateLimitIssue(result.transientIssue)) {
                        sawRateLimit = true;
                        roundSawRateLimit = true;
                    }
                }
            }

            if (!roundSawRateLimit || round >= RATE_LIMIT_RETRY_ROUNDS) {
                break;
            }

            long delayMs = RATE_LIMIT_BACKOFF_MS * round;
            logger.warn("OpenRouter rate-limited across fallback models (round {}). Retrying in {} ms.",
                    round, delayMs);
            try {
                Thread.sleep(delayMs);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        if (lastTransientIssue != null) {
            logger.warn("All OpenRouter attempts failed. Last issue: {}", lastTransientIssue);
            String lowered = lastTransientIssue.toLowerCase(Locale.ROOT);
            if (sawRateLimit) {
                return AiReply.of("All fallback models are rate-limited right now. Please try again shortly.",
                        "unknown");
            }
            if (lowered.contains("model not found") || lowered.contains("model rejected")) {
                return AiReply.of(
                        "Configured model is unavailable. Use one of your fallback models and restart backend.",
                        "unknown");
            }
            if (lowered.contains("no text in choices") || lowered.contains("empty response body")) {
                return AiReply.of("OpenRouter returned an empty response for this request. Please try again.",
                        "unknown");
            }
            if (lowered.contains("timed out") || lowered.contains("connection")) {
                return AiReply.of("Unable to reach OpenRouter right now. Please try again shortly.",
                        "unknown");
            }
        }
        return AiReply.of("AI service is temporarily unavailable. Please try again.", "unknown");
    }

    public List<ChatMessage> getChatHistory(Long userId) {
        return chatRepository.findByUserIdOrderByCreatedAtAsc(userId);
    }

    private HttpEntity<Map<String, Object>> buildOpenRouterRequest(
            String message,
            String model,
            String key) {
        Map<String, Object> userMessage = new HashMap<>();
        userMessage.put("role", "user");
        userMessage.put("content", financeDomainService.buildFinancePrompt(message));

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", Collections.singletonList(userMessage));
        requestBody.put("stream", false);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        headers.setBearerAuth(key);
        headers.set("HTTP-Referer", "http://localhost");
        headers.set("X-Title", "chatbox");

        return new HttpEntity<>(requestBody, headers);
    }

    private OpenRouterAttemptResult requestOpenRouter(
            RestTemplate restTemplate,
            String message,
            String model,
            String key) {

        HttpEntity<Map<String, Object>> entity = buildOpenRouterRequest(message, model, key);
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    OPENROUTER_CHAT_URL,
                    HttpMethod.POST,
                    entity,
                    Map.class
            );

            Map<?, ?> responseBody = response.getBody();
            if (responseBody == null) {
                logger.warn("OpenRouter returned empty body for model {}", model);
                return OpenRouterAttemptResult.transientFailure("empty response body", model);
            }
            String providerError = extractOpenRouterError(responseBody);
            if (providerError != null) {
                logger.warn("OpenRouter response contained error for model {}: {}", model, providerError);
                return OpenRouterAttemptResult.fatal("OpenRouter error: " + providerError, model);
            }

            String text = extractOpenRouterText(responseBody);
            if (text == null || text.isBlank()) {
                logger.warn("OpenRouter response had no text for model {}", model);
                return OpenRouterAttemptResult.transientFailure("no text in choices", model);
            }
            String actualModel = extractOpenRouterModel(responseBody);
            return OpenRouterAttemptResult.success(text, actualModel == null ? model : actualModel);

        } catch (HttpStatusCodeException ex) {
            int status = ex.getStatusCode().value();
            String body = ex.getResponseBodyAsString();
            String loweredBody = body == null ? "" : body.toLowerCase(Locale.ROOT);
            logger.warn(
                    "OpenRouter call failed for model {} with status {}: {}",
                    model,
                    status,
                    body
            );

            if (status == 401) {
                return OpenRouterAttemptResult.fatal(
                        "Invalid OPENROUTER_API_KEY. Update backend/.env and restart backend.",
                        model);
            }
            if (status == 402 || loweredBody.contains("insufficient credits")
                    || loweredBody.contains("not enough credits")
                    || loweredBody.contains("quota")) {
                return OpenRouterAttemptResult.fatal(
                        "OpenRouter credits/quota exceeded. Add credits or use a free model.",
                        model);
            }
            if (status == 429) {
                return OpenRouterAttemptResult.transientFailure(
                        "rate limit (429) for model: " + model,
                        model);
            }
            if (status == 404 || loweredBody.contains("model") && loweredBody.contains("not found")) {
                return OpenRouterAttemptResult.transientFailure("model not found: " + model, model);
            }
            if (status == 400 && loweredBody.contains("model")) {
                return OpenRouterAttemptResult.transientFailure("model rejected: " + model, model);
            }
            if (status >= 500) {
                return OpenRouterAttemptResult.transientFailure("HTTP " + status, model);
            }
            return OpenRouterAttemptResult.fatal(
                    "OpenRouter request failed (HTTP " + status + "). Check key and model settings.",
                    model);
        } catch (RestClientException ex) {
            logger.warn("OpenRouter call failed for model {}: {}", model, ex.getMessage());
            return OpenRouterAttemptResult.transientFailure(ex.getMessage(), model);
        }
    }

    private RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(30_000);
        return new RestTemplate(factory);
    }

    private String extractOpenRouterText(Map<?, ?> responseBody) {
        Object outputTextObj = responseBody.get("output_text");
        if (outputTextObj instanceof String outputText && !outputText.isBlank()) {
            return outputText;
        }

        Object choicesObj = responseBody.get("choices");
        if (!(choicesObj instanceof List<?> choices) || choices.isEmpty()) {
            return null;
        }

        Object choiceObj = choices.get(0);
        if (!(choiceObj instanceof Map<?, ?> choice)) {
            return null;
        }

        Object messageObj = choice.get("message");
        if (!(messageObj instanceof Map<?, ?> assistantMessage)) {
            return null;
        }

        Object contentObj = assistantMessage.get("content");
        if (contentObj instanceof String content && !content.isBlank()) {
            return content;
        }

        // Some providers return content as a list of structured parts.
        if (contentObj instanceof List<?> parts) {
            StringBuilder sb = new StringBuilder();
            for (Object partObj : parts) {
                if (partObj instanceof String strPart && !strPart.isBlank()) {
                    sb.append(strPart);
                    continue;
                }
                if (partObj instanceof Map<?, ?> part) {
                    Object textObj = part.get("text");
                    if (textObj instanceof String text && !text.isBlank()) {
                        sb.append(text);
                    }
                }
            }

            String joined = sb.toString();
            if (!joined.isBlank()) {
                return joined;
            }
        }

        return null;
    }

    private boolean isRateLimitIssue(String issue) {
        if (issue == null) {
            return false;
        }
        String lowered = issue.toLowerCase(Locale.ROOT);
        return lowered.contains("rate limit") || lowered.contains("429");
    }

    private String extractOpenRouterError(Map<?, ?> responseBody) {
        Object errorObj = responseBody.get("error");
        if (errorObj instanceof String errorStr && !errorStr.isBlank()) {
            return errorStr;
        }
        if (errorObj instanceof Map<?, ?> errorMap) {
            Object msg = errorMap.get("message");
            if (msg instanceof String message && !message.isBlank()) {
                return message;
            }
            Object code = errorMap.get("code");
            if (code instanceof String codeStr && !codeStr.isBlank()) {
                return codeStr;
            }
        }
        return null;
    }

    private String extractOpenRouterModel(Map<?, ?> responseBody) {
        Object modelObj = responseBody.get("model");
        if (modelObj instanceof String model && !model.isBlank()) {
            return model;
        }
        return null;
    }

    private String sanitizeApiKey(String key) {
        if (key == null) {
            return "";
        }

        String trimmed = key.trim();
        if (trimmed.length() >= 2 && (
                (trimmed.startsWith("\"") && trimmed.endsWith("\""))
                        || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
            trimmed = trimmed.substring(1, trimmed.length() - 1).trim();
        }
        return trimmed;
    }

    private boolean looksLikePlaceholder(String key) {
        String normalized = key.trim();
        return normalized.startsWith("<") && normalized.endsWith(">")
                || normalized.equalsIgnoreCase("OPENROUTER_API_KEY")
                || normalized.equalsIgnoreCase("your_openrouter_api_key_here");
    }

    public static class AiReply {
        private final String responseText;
        private final String modelUsed;

        private AiReply(String responseText, String modelUsed) {
            this.responseText = responseText;
            this.modelUsed = modelUsed;
        }

        public static AiReply of(String responseText, String modelUsed) {
            return new AiReply(responseText, modelUsed);
        }

        public String responseText() {
            return responseText;
        }

        public String modelUsed() {
            return modelUsed;
        }
    }

    private static class OpenRouterAttemptResult {
        private final String responseText;
        private final String userFacingError;
        private final String transientIssue;
        private final String modelUsed;

        private OpenRouterAttemptResult(
                String responseText,
                String userFacingError,
                String transientIssue,
                String modelUsed) {
            this.responseText = responseText;
            this.userFacingError = userFacingError;
            this.transientIssue = transientIssue;
            this.modelUsed = modelUsed;
        }

        private static OpenRouterAttemptResult success(String responseText, String modelUsed) {
            return new OpenRouterAttemptResult(responseText, null, null, modelUsed);
        }

        private static OpenRouterAttemptResult fatal(String userFacingError, String modelUsed) {
            return new OpenRouterAttemptResult(null, userFacingError, null, modelUsed);
        }

        private static OpenRouterAttemptResult transientFailure(String issue, String modelUsed) {
            return new OpenRouterAttemptResult(null, null, issue, modelUsed);
        }
    }
}

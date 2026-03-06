package com.chatbot.controller;

import com.chatbot.entity.ChatMessage;
import com.chatbot.repository.ChatMessageRepository;
import com.chatbot.service.AiService;
import com.chatbot.service.ChatMessagePersistenceService;
import com.chatbot.service.RuleEngineService;
import com.chatbot.security.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin(exposedHeaders = "X-AI-Model")
public class AiController {
    private static final Logger logger = LoggerFactory.getLogger(AiController.class);

    private final AiService aiService;
    private final RuleEngineService ruleEngineService;
    private final ChatMessageRepository chatRepository;
    private final ChatMessagePersistenceService chatMessagePersistenceService;
    private final JwtUtil jwtUtil;

    public AiController(AiService aiService,
                        RuleEngineService ruleEngineService,
                        ChatMessageRepository chatRepository,
                        ChatMessagePersistenceService chatMessagePersistenceService,
                        JwtUtil jwtUtil) {
        this.aiService = aiService;
        this.ruleEngineService = ruleEngineService;
        this.chatRepository = chatRepository;
        this.chatMessagePersistenceService = chatMessagePersistenceService;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping
    public Map<String, String> chat(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> request) {

        String message = requireMessage(request);
        String conversationId = resolveConversationId(request.get("conversationId"));
        Long userId = extractUserIdFromAuthHeader(authHeader);

        String response;
        String modelUsed;

        // 1️⃣ Check rule engine first
        response = ruleEngineService.checkRules(message);
        modelUsed = "rule-engine";

        // 2️⃣ If no rule matched → call AI
        if (response == null) {
            AiService.AiReply aiReply = aiService.getAiReply(message);
            response = aiReply.responseText();
            modelUsed = normalizeModelUsed(aiReply.modelUsed());
        }

        // 3️⃣ Save chat to database
        ChatMessage chat = new ChatMessage();
        chat.setUserId(userId);
        chat.setConversationId(conversationId);
        chat.setMessage(message);
        chat.setResponse(response);
        chat.setModelUsed(modelUsed);
        chat.setCreatedAt(LocalDateTime.now());

        try {
            chatMessagePersistenceService.save(chat);
        } catch (Exception ex) {
            logger.error("Failed to save non-stream chat message for userId={} conversationId={}",
                    userId, conversationId, ex);
        }

        Map<String, String> result = new HashMap<>();
        result.put("response", response);
        result.put("conversationId", conversationId);
        result.put("model", modelUsed);

        return result;
    }

    // 🔥 STREAMING CHAT (REAL‑TIME TOKEN BY TOKEN)
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<StreamingResponseBody> streamChat(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> request) {

        String message = requireMessage(request);
        String conversationId = resolveConversationId(request.get("conversationId"));
        Long userId = extractUserIdFromAuthHeader(authHeader);
        String response = ruleEngineService.checkRules(message);
        String modelUsed = "rule-engine";

        if (response == null) {
            AiService.AiReply aiReply = aiService.getAiReply(message);
            response = aiReply.responseText();
            modelUsed = normalizeModelUsed(aiReply.modelUsed());
        }

        final String finalResponse = response;
        final String finalModelUsed = modelUsed;

        StreamingResponseBody stream = outputStream -> {
            // Stream by Unicode code point (not UTF-16 char) so emojis are not split.
            for (int i = 0; i < finalResponse.length(); ) {
                int codePoint = finalResponse.codePointAt(i);
                String token = new String(Character.toChars(codePoint));
                String dataToken = switch (token) {
                    case "\n" -> "\\n";
                    case "\r" -> "\\r";
                    default -> token;
                };
                String chunk = "data: " + dataToken + "\n\n";

                try {
                    outputStream.write(chunk.getBytes(StandardCharsets.UTF_8));
                    outputStream.flush();
                    Thread.sleep(15);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    logger.warn("Streaming interrupted for userId={} conversationId={}",
                            userId, conversationId);
                    break;
                } catch (Exception ex) {
                    logger.warn("Streaming write failed for userId={} conversationId={}: {}",
                            userId, conversationId, ex.getMessage());
                    break;
                }

                i += Character.charCount(codePoint);
            }

            // Save to DB after streaming finishes
            ChatMessage chat = new ChatMessage();
            chat.setUserId(userId);
            chat.setConversationId(conversationId);
            chat.setMessage(message);
            chat.setResponse(finalResponse);
            chat.setModelUsed(finalModelUsed);
            chat.setCreatedAt(LocalDateTime.now());

            try {
                chatMessagePersistenceService.save(chat);
            } catch (Exception ex) {
                logger.error("Failed to save stream chat message for userId={} conversationId={}",
                        userId, conversationId, ex);
            }
        };

        return ResponseEntity.ok()
                .header("X-AI-Model", modelUsed)
                .contentType(MediaType.parseMediaType("text/event-stream;charset=UTF-8"))
                .body(stream);
    }

    // 4️⃣ Get chat history for current user
    @GetMapping("/history")
    public List<ChatMessage> getHistory(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "conversationId", required = false) String conversationId) {

        Long userId = extractUserIdFromAuthHeader(authHeader);
        if (conversationId != null && !conversationId.trim().isEmpty()) {
            return chatRepository.findByUserIdAndConversationIdOrderByCreatedAtAsc(
                    userId,
                    conversationId.trim());
        }

        return chatRepository.findByUserIdOrderByCreatedAtAsc(userId);
    }

    @DeleteMapping("/history")
    @Transactional
    public Map<String, Object> clearHistory(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "conversationId") String conversationId) {
        Long userId = extractUserIdFromAuthHeader(authHeader);
        String normalizedConversationId = conversationId == null ? "" : conversationId.trim();

        long deleted;
        if (normalizedConversationId.isEmpty()) {
            deleted = chatRepository.deleteByUserIdAndConversationIdIsNull(userId);
        } else {
            deleted = chatRepository.deleteByUserIdAndConversationId(userId, normalizedConversationId);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("deleted", deleted);
        result.put("conversationId", normalizedConversationId.isEmpty() ? null : normalizedConversationId);
        return result;
    }

    private Long extractUserIdFromAuthHeader(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Missing or invalid Authorization header");
        }

        String token = authHeader.substring(7).trim();
        if (token.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing JWT token");
        }

        try {
            return jwtUtil.extractUserId(token);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid JWT token");
        }
    }

    private String requireMessage(Map<String, String> request) {
        String message = request.get("message");
        if (message == null || message.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message is required");
        }
        return message;
    }

    private String resolveConversationId(String conversationId) {
        if (conversationId == null || conversationId.trim().isEmpty()) {
            return "conv-" + UUID.randomUUID();
        }
        return conversationId.trim();
    }

    private String normalizeModelUsed(String modelUsed) {
        if (modelUsed == null || modelUsed.trim().isEmpty()) {
            return "unknown";
        }
        return modelUsed.trim();
    }
}

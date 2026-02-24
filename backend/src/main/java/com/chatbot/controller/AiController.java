package com.chatbot.controller;

import com.chatbot.entity.ChatMessage;
import com.chatbot.repository.ChatMessageRepository;
import com.chatbot.service.AiService;
import com.chatbot.service.RuleEngineService;
import com.chatbot.security.JwtUtil;
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
@CrossOrigin
public class AiController {

    private final AiService aiService;
    private final RuleEngineService ruleEngineService;
    private final ChatMessageRepository chatRepository;
    private final JwtUtil jwtUtil;

    public AiController(AiService aiService,
                        RuleEngineService ruleEngineService,
                        ChatMessageRepository chatRepository,
                        JwtUtil jwtUtil) {
        this.aiService = aiService;
        this.ruleEngineService = ruleEngineService;
        this.chatRepository = chatRepository;
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

        // 1️⃣ Check rule engine first
        response = ruleEngineService.checkRules(message);

        // 2️⃣ If no rule matched → call AI
        if (response == null) {
            response = aiService.getAiResponse(message);
        }

        // 3️⃣ Save chat to database
        ChatMessage chat = new ChatMessage();
        chat.setUserId(userId);
        chat.setConversationId(conversationId);
        chat.setMessage(message);
        chat.setResponse(response);
        chat.setCreatedAt(LocalDateTime.now());

        chatRepository.save(chat);

        Map<String, String> result = new HashMap<>();
        result.put("response", response);
        result.put("conversationId", conversationId);

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

        StreamingResponseBody stream = outputStream -> {

            String response;

            // Rule engine first
            response = ruleEngineService.checkRules(message);

            if (response == null) {
                response = aiService.getAiResponse(message);
            }

            // Stream by Unicode code point (not UTF-16 char) so emojis are not split into "??".
            for (int i = 0; i < response.length(); ) {
                try {
                    int codePoint = response.codePointAt(i);
                    String token = new String(Character.toChars(codePoint));
                    String chunk = "data: " + token + "\n\n";
                    outputStream.write(chunk.getBytes(StandardCharsets.UTF_8));
                    outputStream.flush();   // VERY IMPORTANT
                    Thread.sleep(15);
                    i += Character.charCount(codePoint);
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }

            // Save to DB after streaming finishes
            ChatMessage chat = new ChatMessage();
            chat.setUserId(userId);
            chat.setConversationId(conversationId);
            chat.setMessage(message);
            chat.setResponse(response);
            chat.setCreatedAt(LocalDateTime.now());

            chatRepository.save(chat);
        };

        return ResponseEntity.ok()
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
}

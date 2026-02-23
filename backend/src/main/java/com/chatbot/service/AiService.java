package com.chatbot.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class AiService {

    @Value("${google.api.key}")
    private String apiKey;

    private static final String API_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    public String getAIResponse(String message) {

        if (message == null || message.trim().isEmpty()) {
            return "Please type something.";
        }

        String msg = message.toLowerCase();

        // ======================
        // RULE BASED RESPONSES
        // ======================

        if (msg.contains("hello") || msg.contains("hi") || msg.contains("hey")) {
            return "Hello! How can I assist you today?";
        }

        if (msg.contains("how are you")) {
            return "I am functioning perfectly as a hybrid chatbot!";
        }

        if (msg.contains("your name")) {
            return "I am a Hybrid Chatbot using Rule-Based logic and Gemini AI.";
        }

        if (msg.contains("bye")) {
            return "Goodbye! Have a great day.";
        }

        if (msg.contains("help")) {
            return "You can ask me anything. I will try to help using rules or AI.";
        }

        // ======================
        // GEMINI AI FALLBACK
        // ======================

        try {

            RestTemplate restTemplate = new RestTemplate();

            Map<String, Object> requestBody = new HashMap<>();
            Map<String, Object> parts = new HashMap<>();
            parts.put("text", message);

            Map<String, Object> content = new HashMap<>();
            content.put("parts", Collections.singletonList(parts));

            requestBody.put("contents", Collections.singletonList(content));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity =
                    new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                    API_URL + "?key=" + apiKey,
                    HttpMethod.POST,
                    entity,
                    Map.class
            );

            Map responseBody = response.getBody();

            if (responseBody != null) {

                List candidates = (List) responseBody.get("candidates");

                if (candidates != null && !candidates.isEmpty()) {

                    Map candidate = (Map) candidates.get(0);
                    Map contentMap = (Map) candidate.get("content");
                    List partsList = (List) contentMap.get("parts");

                    if (partsList != null && !partsList.isEmpty()) {
                        Map firstPart = (Map) partsList.get(0);
                        return (String) firstPart.get("text");
                    }
                }
            }

            return "No response from AI.";

        } catch (Exception e) {
            e.printStackTrace();
            return "Error: Failed to contact AI service.";
        }
    }
}
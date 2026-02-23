package com.chatbot.service;

import org.springframework.stereotype.Service;

@Service
public class RuleEngineService {

    public String checkRules(String message) {

        if (message == null) return null;

        message = message.toLowerCase().trim();

        // Greetings
        if (message.contains("hi") || message.contains("hello")) {
            return "Hello 👋 How can I help you?";
        }

        // Project related
        if (message.contains("your name")) {
            return "I am an AI Assistant created using Spring Boot and React.";
        }

        if (message.contains("what can you do")) {
            return "I can answer questions, generate code, and help with learning topics.";
        }

        // Help
        if (message.contains("help")) {
            return "You can ask me coding, theory, or general questions.";
        }

        // Thanks
        if (message.contains("thank")) {
            return "You're welcome 😊";
        }

        // Exit
        if (message.contains("bye")) {
            return "Goodbye! Have a great day 🚀";
        }

        // No rule matched
        return null;
    }
}
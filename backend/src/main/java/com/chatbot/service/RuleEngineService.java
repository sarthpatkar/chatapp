package com.chatbot.service;

import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

@Service
public class RuleEngineService {

    private final FinanceDomainService financeDomainService;

    public RuleEngineService(FinanceDomainService financeDomainService) {
        this.financeDomainService = financeDomainService;
    }

    public String checkRules(String message) {

        if (message == null) {
            return null;
        }

        message = message.toLowerCase().trim();
        if (message.isEmpty()) {
            return "Please enter a finance or stock-related question.";
        }

        // Greetings
        if (containsWord(message, "hi") || containsWord(message, "hello") || containsWord(message, "hey")) {
            return "Hello 👋 I focus on finance topics and Indian listed stocks (NSE/BSE). How can I help?";
        }

        // Project related
        if (message.contains("your name")) {
            return "I am your finance-focused AI assistant for Indian markets and finance analysis.";
        }

        if (message.contains("what can you do")) {
            return financeDomainService.scopeHelpMessage();
        }

        // Help
        if (containsWord(message, "help")) {
            return financeDomainService.scopeHelpMessage();
        }

        // Thanks
        if (message.contains("thank")) {
            return "You're welcome. Ask any stock or finance question anytime.";
        }

        // Exit
        if (containsWord(message, "bye")) {
            return "Goodbye! Have a great day 🚀";
        }

        String scopeViolation = financeDomainService.validateScope(message);
        if (scopeViolation != null) {
            return scopeViolation;
        }

        // No rule matched
        return null;
    }

    private boolean containsWord(String message, String word) {
        return Pattern.compile("\\b" + Pattern.quote(word) + "\\b").matcher(message).find();
    }
}

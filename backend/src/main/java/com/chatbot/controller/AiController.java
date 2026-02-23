package com.chatbot.controller;

import com.chatbot.dto.AiRequest;
import com.chatbot.dto.AiResponse;
import com.chatbot.service.AiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
public class AiController {

    @Autowired
    private AiService aiService;

    @PostMapping("/chat")
    public AiResponse chat(@RequestBody AiRequest request) {
        String reply = aiService.getAIResponse(request.getMessage());
        return new AiResponse(reply);
    }
}
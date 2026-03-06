package com.chatbot.service;

import com.chatbot.entity.ChatMessage;
import com.chatbot.repository.ChatMessageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChatMessagePersistenceService {

    private final ChatMessageRepository chatMessageRepository;

    public ChatMessagePersistenceService(ChatMessageRepository chatMessageRepository) {
        this.chatMessageRepository = chatMessageRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void save(ChatMessage chatMessage) {
        chatMessageRepository.save(chatMessage);
    }
}


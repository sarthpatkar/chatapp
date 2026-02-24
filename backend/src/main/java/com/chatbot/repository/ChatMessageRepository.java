package com.chatbot.repository;

import com.chatbot.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatMessageRepository
        extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findByUserIdOrderByCreatedAtAsc(Long userId);

    List<ChatMessage> findByUserIdAndConversationIdOrderByCreatedAtAsc(
            Long userId,
            String conversationId);

    long deleteByUserIdAndConversationId(Long userId, String conversationId);

    long deleteByUserIdAndConversationIdIsNull(Long userId);
}

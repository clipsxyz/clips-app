import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket, WebSocketMessage } from './useWebSocket';
import { useAuth } from '../context/Auth';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'system';
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  replyTo?: string;
  reactions?: { [emoji: string]: string[] }; // emoji -> user IDs
  edited?: boolean;
  editedAt?: number;
  metadata?: {
    fileName?: string;
    fileSize?: number;
    duration?: number;
    dimensions?: { width: number; height: number };
  };
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  avatar?: string;
  participants: {
    id: string;
    name: string;
    avatar?: string;
    isOnline: boolean;
    lastSeen?: number;
  }[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: number;
  updatedAt: number;
  isTyping?: string[]; // user IDs currently typing
}

export const useRealTimeMessages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<{ [conversationId: string]: Message[] }>({});
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState<{ [conversationId: string]: string[] }>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  
  const typingTimeoutRef = useRef<{ [conversationId: string]: NodeJS.Timeout }>({});

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((wsMessage: WebSocketMessage) => {
    switch (wsMessage.type) {
      case 'message':
        handleNewMessage(wsMessage.data);
        break;
      case 'message_status':
        handleMessageStatusUpdate(wsMessage.data);
        break;
      case 'typing_start':
        handleTypingStart(wsMessage.data);
        break;
      case 'typing_stop':
        handleTypingStop(wsMessage.data);
        break;
      case 'user_online':
        handleUserOnline(wsMessage.data);
        break;
      case 'user_offline':
        handleUserOffline(wsMessage.data);
        break;
      case 'conversation_updated':
        handleConversationUpdate(wsMessage.data);
        break;
      case 'message_reaction':
        handleMessageReaction(wsMessage.data);
        break;
      case 'message_edited':
        handleMessageEdit(wsMessage.data);
        break;
      case 'message_deleted':
        handleMessageDelete(wsMessage.data);
        break;
    }
  }, []);

  const { isConnected, send } = useWebSocket({
    onMessage: handleWebSocketMessage
  });

  // Handle new message
  const handleNewMessage = useCallback((message: Message) => {
    setMessages(prev => ({
      ...prev,
      [message.conversationId]: [
        ...(prev[message.conversationId] || []),
        message
      ].sort((a, b) => a.timestamp - b.timestamp)
    }));

    // Update conversation with last message
    setConversations(prev => prev.map(conv => 
      conv.id === message.conversationId
        ? {
            ...conv,
            lastMessage: message,
            updatedAt: message.timestamp,
            unreadCount: message.senderId !== user?.id 
              ? conv.unreadCount + 1 
              : conv.unreadCount
          }
        : conv
    ));

    // Show notification if not in active conversation
    if (message.senderId !== user?.id && message.conversationId !== activeConversation) {
      showMessageNotification(message);
    }
  }, [user?.id, activeConversation]);

  // Handle message status update
  const handleMessageStatusUpdate = useCallback((data: { messageId: string; status: Message['status'] }) => {
    setMessages(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(conversationId => {
        updated[conversationId] = updated[conversationId].map(msg =>
          msg.id === data.messageId ? { ...msg, status: data.status } : msg
        );
      });
      return updated;
    });
  }, []);

  // Handle typing indicators
  const handleTypingStart = useCallback((data: { conversationId: string; userId: string; userName: string }) => {
    setIsTyping(prev => ({
      ...prev,
      [data.conversationId]: [
        ...(prev[data.conversationId] || []).filter(id => id !== data.userId),
        data.userId
      ]
    }));

    // Auto-clear typing after 3 seconds
    if (typingTimeoutRef.current[data.conversationId]) {
      clearTimeout(typingTimeoutRef.current[data.conversationId]);
    }
    
    typingTimeoutRef.current[data.conversationId] = setTimeout(() => {
      handleTypingStop({ conversationId: data.conversationId, userId: data.userId });
    }, 3000);
  }, []);

  const handleTypingStop = useCallback((data: { conversationId: string; userId: string }) => {
    setIsTyping(prev => ({
      ...prev,
      [data.conversationId]: (prev[data.conversationId] || []).filter(id => id !== data.userId)
    }));

    if (typingTimeoutRef.current[data.conversationId]) {
      clearTimeout(typingTimeoutRef.current[data.conversationId]);
      delete typingTimeoutRef.current[data.conversationId];
    }
  }, []);

  // Handle user presence
  const handleUserOnline = useCallback((data: { userId: string }) => {
    setOnlineUsers(prev => new Set([...prev, data.userId]));
    
    // Update conversations with online status
    setConversations(prev => prev.map(conv => ({
      ...conv,
      participants: conv.participants.map(p =>
        p.id === data.userId ? { ...p, isOnline: true } : p
      )
    })));
  }, []);

  const handleUserOffline = useCallback((data: { userId: string; lastSeen: number }) => {
    setOnlineUsers(prev => {
      const updated = new Set(prev);
      updated.delete(data.userId);
      return updated;
    });

    // Update conversations with offline status
    setConversations(prev => prev.map(conv => ({
      ...conv,
      participants: conv.participants.map(p =>
        p.id === data.userId ? { ...p, isOnline: false, lastSeen: data.lastSeen } : p
      )
    })));
  }, []);

  // Handle conversation updates
  const handleConversationUpdate = useCallback((conversation: Conversation) => {
    setConversations(prev => {
      const existing = prev.find(c => c.id === conversation.id);
      if (existing) {
        return prev.map(c => c.id === conversation.id ? conversation : c);
      } else {
        return [...prev, conversation];
      }
    });
  }, []);

  // Handle message reactions
  const handleMessageReaction = useCallback((data: { messageId: string; emoji: string; userId: string; action: 'add' | 'remove' }) => {
    setMessages(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(conversationId => {
        updated[conversationId] = updated[conversationId].map(msg => {
          if (msg.id === data.messageId) {
            const reactions = { ...msg.reactions };
            if (!reactions[data.emoji]) {
              reactions[data.emoji] = [];
            }
            
            if (data.action === 'add') {
              if (!reactions[data.emoji].includes(data.userId)) {
                reactions[data.emoji].push(data.userId);
              }
            } else {
              reactions[data.emoji] = reactions[data.emoji].filter(id => id !== data.userId);
              if (reactions[data.emoji].length === 0) {
                delete reactions[data.emoji];
              }
            }
            
            return { ...msg, reactions };
          }
          return msg;
        });
      });
      return updated;
    });
  }, []);

  // Handle message edits
  const handleMessageEdit = useCallback((data: { messageId: string; content: string; editedAt: number }) => {
    setMessages(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(conversationId => {
        updated[conversationId] = updated[conversationId].map(msg =>
          msg.id === data.messageId 
            ? { ...msg, content: data.content, edited: true, editedAt: data.editedAt }
            : msg
        );
      });
      return updated;
    });
  }, []);

  // Handle message deletion
  const handleMessageDelete = useCallback((data: { messageId: string }) => {
    setMessages(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(conversationId => {
        updated[conversationId] = updated[conversationId].filter(msg => msg.id !== data.messageId);
      });
      return updated;
    });
  }, []);

  // Show message notification
  const showMessageNotification = useCallback((message: Message) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(`New message from ${message.senderName}`, {
        body: message.type === 'text' ? message.content : `Sent a ${message.type}`,
        icon: message.senderAvatar || '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: `message-${message.conversationId}`,
        renotify: true,
        silent: false
      });

      notification.onclick = () => {
        window.focus();
        setActiveConversation(message.conversationId);
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }
  }, []);

  // Send message
  const sendMessage = useCallback(async (conversationId: string, content: string, type: Message['type'] = 'text', replyTo?: string) => {
    if (!user || !isConnected) return null;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const message: Message = {
      id: tempId,
      conversationId,
      senderId: user.id,
      senderName: user.name,
      senderAvatar: user.profileImage,
      content,
      type,
      timestamp: Date.now(),
      status: 'sending',
      replyTo
    };

    // Add message optimistically
    setMessages(prev => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), message]
    }));

    // Send through WebSocket
    const messageId = send({
      type: 'send_message',
      data: message,
      timestamp: Date.now()
    });

    return messageId;
  }, [user, isConnected, send]);

  // Start typing
  const startTyping = useCallback((conversationId: string) => {
    if (!user || !isConnected) return;

    send({
      type: 'typing_start',
      data: { conversationId, userId: user.id, userName: user.name },
      timestamp: Date.now()
    });
  }, [user, isConnected, send]);

  // Stop typing
  const stopTyping = useCallback((conversationId: string) => {
    if (!user || !isConnected) return;

    send({
      type: 'typing_stop',
      data: { conversationId, userId: user.id },
      timestamp: Date.now()
    });
  }, [user, isConnected, send]);

  // Mark messages as read
  const markAsRead = useCallback((conversationId: string) => {
    if (!user || !isConnected) return;

    send({
      type: 'mark_read',
      data: { conversationId, userId: user.id },
      timestamp: Date.now()
    });

    // Update local state
    setConversations(prev => prev.map(conv =>
      conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
    ));
  }, [user, isConnected, send]);

  // Add reaction to message
  const addReaction = useCallback((messageId: string, emoji: string) => {
    if (!user || !isConnected) return;

    send({
      type: 'add_reaction',
      data: { messageId, emoji, userId: user.id },
      timestamp: Date.now()
    });
  }, [user, isConnected, send]);

  // Remove reaction from message
  const removeReaction = useCallback((messageId: string, emoji: string) => {
    if (!user || !isConnected) return;

    send({
      type: 'remove_reaction',
      data: { messageId, emoji, userId: user.id },
      timestamp: Date.now()
    });
  }, [user, isConnected, send]);

  // Edit message
  const editMessage = useCallback((messageId: string, content: string) => {
    if (!user || !isConnected) return;

    send({
      type: 'edit_message',
      data: { messageId, content, editedAt: Date.now() },
      timestamp: Date.now()
    });
  }, [user, isConnected, send]);

  // Delete message
  const deleteMessage = useCallback((messageId: string) => {
    if (!user || !isConnected) return;

    send({
      type: 'delete_message',
      data: { messageId },
      timestamp: Date.now()
    });
  }, [user, isConnected, send]);

  // Load conversations on mount
  useEffect(() => {
    if (user && isConnected) {
      send({
        type: 'load_conversations',
        data: { userId: user.id },
        timestamp: Date.now()
      });
    }
  }, [user, isConnected, send]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Cleanup typing timeouts
  useEffect(() => {
    return () => {
      Object.values(typingTimeoutRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);

  return {
    conversations: conversations.sort((a, b) => b.updatedAt - a.updatedAt),
    messages,
    activeConversation,
    isTyping,
    onlineUsers,
    isConnected,
    setActiveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
    addReaction,
    removeReaction,
    editMessage,
    deleteMessage
  };
};




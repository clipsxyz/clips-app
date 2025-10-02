import React, { useState, useRef, useEffect } from 'react';
import { FiArrowLeft, FiSend, FiSmile, FiPaperclip, FiMoreVertical, FiPhone, FiVideo, FiSearch, FiEdit3 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useRealTimeMessages, Message, Conversation } from '../hooks/useRealTimeMessages';
import { useAuth } from '../context/Auth';
import TouchFeedback from './TouchFeedback';

interface MessagesPageProps {
  conversationId?: string;
}

export default function MessagesPage({ conversationId }: MessagesPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    conversations,
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
    removeReaction
  } = useRealTimeMessages();

  const [messageText, setMessageText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Set active conversation from props
  useEffect(() => {
    if (conversationId && conversationId !== activeConversation) {
      setActiveConversation(conversationId);
    }
  }, [conversationId, activeConversation, setActiveConversation]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeConversation]);

  // Mark messages as read when conversation becomes active
  useEffect(() => {
    if (activeConversation) {
      markAsRead(activeConversation);
    }
  }, [activeConversation, markAsRead]);

  // Handle typing indicators
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
    
    if (activeConversation) {
      startTyping(activeConversation);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 1 second of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(activeConversation);
      }, 1000);
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageText.trim() || !activeConversation) return;
    
    await sendMessage(activeConversation, messageText.trim(), 'text', replyTo?.id);
    setMessageText('');
    setReplyTo(null);
    
    if (activeConversation) {
      stopTyping(activeConversation);
    }
    
    inputRef.current?.focus();
  };

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv =>
    conv.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.participants.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Get current conversation
  const currentConversation = conversations.find(c => c.id === activeConversation);
  const currentMessages = activeConversation ? messages[activeConversation] || [] : [];

  // Format time
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Get conversation name
  const getConversationName = (conversation: Conversation) => {
    if (conversation.name) return conversation.name;
    
    const otherParticipants = conversation.participants.filter(p => p.id !== user?.id);
    return otherParticipants.map(p => p.name).join(', ');
  };

  // Get conversation avatar
  const getConversationAvatar = (conversation: Conversation) => {
    if (conversation.avatar) return conversation.avatar;
    
    const otherParticipants = conversation.participants.filter(p => p.id !== user?.id);
    return otherParticipants[0]?.avatar;
  };

  // Render conversation list
  if (!activeConversation) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-950">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <TouchFeedback onTap={() => navigate(-1)}>
              <div className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                <FiArrowLeft size={20} />
              </div>
            </TouchFeedback>
            <h1 className="text-xl font-bold">Messages</h1>
          </div>
          <div className="flex items-center gap-2">
            <TouchFeedback onTap={() => setShowEmojiPicker(!showEmojiPicker)}>
              <div className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                <FiEdit3 size={20} />
              </div>
            </TouchFeedback>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full border-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-700"
            />
          </div>
        </div>

        {/* Connection status */}
        {!isConnected && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center">
              Connecting to messages...
            </p>
          </div>
        )}

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <FiEdit3 size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No conversations yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Start a conversation with someone to see it here
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const isOnline = conversation.participants.some(p => 
                p.id !== user?.id && onlineUsers.has(p.id)
              );
              
              return (
                <TouchFeedback
                  key={conversation.id}
                  onTap={() => setActiveConversation(conversation.id)}
                  className="block"
                >
                  <div className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800/50">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                        {getConversationAvatar(conversation) ? (
                          <img
                            src={getConversationAvatar(conversation)}
                            alt=""
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          getConversationName(conversation).slice(0, 1).toUpperCase()
                        )}
                      </div>
                      {isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-950" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold truncate">
                          {getConversationName(conversation)}
                        </h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {conversation.lastMessage && formatTime(conversation.lastMessage.timestamp)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {isTyping[conversation.id]?.length > 0 ? (
                            <span className="text-blue-500 italic">
                              {isTyping[conversation.id].length === 1 ? 'Typing...' : `${isTyping[conversation.id].length} people typing...`}
                            </span>
                          ) : conversation.lastMessage ? (
                            <>
                              {conversation.lastMessage.senderId === user?.id && (
                                <span className="text-gray-400 mr-1">You: </span>
                              )}
                              {conversation.lastMessage.type === 'text' 
                                ? conversation.lastMessage.content 
                                : `Sent a ${conversation.lastMessage.type}`
                              }
                            </>
                          ) : (
                            'No messages yet'
                          )}
                        </p>
                        
                        {conversation.unreadCount > 0 && (
                          <div className="bg-blue-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TouchFeedback>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Render conversation view
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-3">
          <TouchFeedback onTap={() => setActiveConversation(null)}>
            <div className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
              <FiArrowLeft size={20} />
            </div>
          </TouchFeedback>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                {getConversationAvatar(currentConversation!) ? (
                  <img
                    src={getConversationAvatar(currentConversation!)}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  getConversationName(currentConversation!).slice(0, 1).toUpperCase()
                )}
              </div>
              {currentConversation?.participants.some(p => p.id !== user?.id && onlineUsers.has(p.id)) && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-950" />
              )}
            </div>
            
            <div>
              <h2 className="font-semibold">
                {getConversationName(currentConversation!)}
              </h2>
              {isTyping[activeConversation]?.length > 0 ? (
                <p className="text-xs text-blue-500">
                  {isTyping[activeConversation].length === 1 ? 'Typing...' : `${isTyping[activeConversation].length} people typing...`}
                </p>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {currentConversation?.participants.some(p => p.id !== user?.id && onlineUsers.has(p.id)) 
                    ? 'Online' 
                    : 'Last seen recently'
                  }
                </p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <TouchFeedback onTap={() => {}}>
            <div className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
              <FiPhone size={20} />
            </div>
          </TouchFeedback>
          <TouchFeedback onTap={() => {}}>
            <div className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
              <FiVideo size={20} />
            </div>
          </TouchFeedback>
          <TouchFeedback onTap={() => {}}>
            <div className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
              <FiMoreVertical size={20} />
            </div>
          </TouchFeedback>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {currentMessages.map((message, index) => {
          const isOwn = message.senderId === user?.id;
          const showAvatar = !isOwn && (
            index === 0 || 
            currentMessages[index - 1].senderId !== message.senderId ||
            message.timestamp - currentMessages[index - 1].timestamp > 300000 // 5 minutes
          );
          
          return (
            <div
              key={message.id}
              className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              {!isOwn && (
                <div className="w-8 h-8 flex-shrink-0">
                  {showAvatar && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                      {message.senderAvatar ? (
                        <img
                          src={message.senderAvatar}
                          alt=""
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        message.senderName.slice(0, 1).toUpperCase()
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                {showAvatar && !isOwn && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-3">
                    {message.senderName}
                  </p>
                )}
                
                <TouchFeedback
                  onLongPress={() => {
                    // Show message options
                  }}
                  className={`px-4 py-2 rounded-2xl ${
                    isOwn
                      ? 'bg-blue-500 text-white rounded-br-md'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  
                  {message.reactions && Object.keys(message.reactions).length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {Object.entries(message.reactions).map(([emoji, userIds]) => (
                        <TouchFeedback
                          key={emoji}
                          onTap={() => {
                            if (userIds.includes(user?.id || '')) {
                              removeReaction(message.id, emoji);
                            } else {
                              addReaction(message.id, emoji);
                            }
                          }}
                          className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                            userIds.includes(user?.id || '')
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span>{userIds.length}</span>
                        </TouchFeedback>
                      ))}
                    </div>
                  )}
                </TouchFeedback>
                
                <div className={`flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400 ${isOwn ? 'flex-row-reverse' : ''}`}>
                  <span>{formatTime(message.timestamp)}</span>
                  {isOwn && (
                    <span className={`${
                      message.status === 'read' ? 'text-blue-500' :
                      message.status === 'delivered' ? 'text-gray-400' :
                      message.status === 'sent' ? 'text-gray-400' :
                      message.status === 'sending' ? 'text-gray-300' :
                      'text-red-500'
                    }`}>
                      {message.status === 'read' ? '✓✓' :
                       message.status === 'delivered' ? '✓✓' :
                       message.status === 'sent' ? '✓' :
                       message.status === 'sending' ? '○' :
                       '✗'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Replying to {replyTo.senderName}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                {replyTo.content}
              </p>
            </div>
            <TouchFeedback onTap={() => setReplyTo(null)}>
              <div className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                <FiArrowLeft size={16} className="rotate-45" />
              </div>
            </TouchFeedback>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={messageText}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="w-full px-4 py-3 pr-12 bg-gray-100 dark:bg-gray-800 rounded-full border-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-700 resize-none"
              disabled={!isConnected}
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              <TouchFeedback onTap={() => setShowEmojiPicker(!showEmojiPicker)}>
                <div className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full">
                  <FiSmile size={16} />
                </div>
              </TouchFeedback>
              <TouchFeedback onTap={() => {}}>
                <div className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full">
                  <FiPaperclip size={16} />
                </div>
              </TouchFeedback>
            </div>
          </div>
          
          <TouchFeedback onTap={handleSendMessage}>
            <div className={`p-3 rounded-full ${
              messageText.trim() && isConnected
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
            }`}>
              <FiSend size={20} />
            </div>
          </TouchFeedback>
        </form>
      </div>
    </div>
  );
}

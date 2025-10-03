import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/Auth';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
  id: string;
}

interface WebSocketOptions {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
}

export const useWebSocket = (options: WebSocketOptions = {}) => {
  const { user } = useAuth();
  const {
    url = process.env.NODE_ENV === 'production' 
      ? 'wss://api.gossapp.com/ws' 
      : 'ws://localhost:8080/ws',
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    heartbeatInterval = 30000,
    onOpen,
    onClose,
    onError,
    onMessage
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const messageQueueRef = useRef<WebSocketMessage[]>([]);

  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Send heartbeat to keep connection alive
  const sendHeartbeat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send({
        type: 'heartbeat',
        data: { timestamp: Date.now() },
        timestamp: Date.now(),
        id: generateMessageId()
      });
    }
  }, []);

  // Start heartbeat interval
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
    }
    heartbeatTimeoutRef.current = setInterval(sendHeartbeat, heartbeatInterval);
  }, [sendHeartbeat, heartbeatInterval]);

  // Stop heartbeat interval
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!user) {
      console.log('WebSocket: No user authenticated, skipping connection');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket: Already connected');
      return;
    }

    try {
      setConnectionState('connecting');
      console.log('WebSocket: Connecting to', url);
      
      const token = localStorage.getItem('accessToken');
      const wsUrl = token ? `${url}?token=${token}` : url;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket: Connected');
        setIsConnected(true);
        setConnectionState('connected');
        reconnectAttemptsRef.current = 0;
        startHeartbeat();
        
        // Send queued messages
        while (messageQueueRef.current.length > 0) {
          const queuedMessage = messageQueueRef.current.shift();
          if (queuedMessage) {
            wsRef.current?.send(JSON.stringify(queuedMessage));
          }
        }
        
        onOpen?.();
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket: Disconnected', event.code, event.reason);
        setIsConnected(false);
        setConnectionState('disconnected');
        stopHeartbeat();
        
        // Attempt to reconnect if not a clean close
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          scheduleReconnect();
        }
        
        onClose?.();
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket: Error', error);
        setConnectionState('error');
        onError?.(error);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket: Message received', message.type);
          
          // Handle heartbeat response
          if (message.type === 'heartbeat') {
            return;
          }
          
          setLastMessage(message);
          onMessage?.(message);
        } catch (error) {
          console.error('WebSocket: Failed to parse message', error);
        }
      };

    } catch (error) {
      console.error('WebSocket: Connection failed', error);
      setConnectionState('error');
      scheduleReconnect();
    }
  }, [user, url, onOpen, onClose, onError, onMessage, startHeartbeat, stopHeartbeat, maxReconnectAttempts]);

  // Schedule reconnection attempt
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log('WebSocket: Max reconnect attempts reached');
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = Math.min(reconnectInterval * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
    
    console.log(`WebSocket: Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect, reconnectInterval, maxReconnectAttempts]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    console.log('WebSocket: Disconnecting');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    stopHeartbeat();
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionState('disconnected');
  }, [stopHeartbeat]);

  // Send message through WebSocket
  const send = useCallback((message: Omit<WebSocketMessage, 'id'>) => {
    const fullMessage: WebSocketMessage = {
      ...message,
      id: generateMessageId()
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(fullMessage));
      console.log('WebSocket: Message sent', fullMessage.type);
    } else {
      // Queue message for when connection is restored
      messageQueueRef.current.push(fullMessage);
      console.log('WebSocket: Message queued', fullMessage.type);
    }

    return fullMessage.id;
  }, [generateMessageId]);

  // Force reconnect
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    setTimeout(connect, 1000);
  }, [disconnect, connect]);

  // Auto-connect when user is authenticated
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, reduce heartbeat frequency
        stopHeartbeat();
      } else {
        // Page is visible, resume normal heartbeat
        if (isConnected) {
          startHeartbeat();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, startHeartbeat, stopHeartbeat]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('WebSocket: Back online, reconnecting');
      if (!isConnected) {
        reconnect();
      }
    };

    const handleOffline = () => {
      console.log('WebSocket: Gone offline');
      // Don't disconnect immediately, let the connection timeout naturally
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConnected, reconnect]);

  return {
    isConnected,
    connectionState,
    lastMessage,
    send,
    connect,
    disconnect,
    reconnect,
    queuedMessages: messageQueueRef.current.length
  };
};



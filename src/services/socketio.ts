import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
    return socket;
}

export function connectSocket(userHandle: string): Socket {
    if (socket?.connected) {
        return socket;
    }

    // Connect to Socket.IO server
    // In development, use localhost. In production, use your server URL
    const serverUrl = import.meta.env.VITE_SOCKETIO_URL || 'http://localhost:3001';
    
    socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
        console.log('Connected to Socket.IO server');
        // Register user with their handle
        socket?.emit('register', { userHandle });
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from Socket.IO server');
    });

    socket.on('connect_error', (error) => {
        // Only log if it's not a connection refused error (expected when server is not running)
        // The app will gracefully fall back to Custom Events
        if (!error.message?.includes('websocket error') && !error.message?.includes('xhr poll error')) {
            console.error('Socket.IO connection error:', error);
        }
    });

    return socket;
}

export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

export function emitMessage(from: string, to: string, message: any): void {
    if (socket?.connected) {
        socket.emit('newMessage', { from, to, message });
    } else {
        console.warn('Socket not connected, falling back to Custom Events');
        // Fallback to Custom Events if Socket.IO is not available
        window.dispatchEvent(new CustomEvent('conversationUpdated', { 
            detail: { participants: [from, to], message } 
        }));
    }
}

export function emitConversationUpdate(data: any): void {
    if (socket?.connected) {
        socket.emit('conversationUpdate', data);
    } else {
        // Fallback to Custom Events
        window.dispatchEvent(new CustomEvent('conversationUpdated', { detail: data }));
    }
}

export function emitInboxUnreadChanged(handle: string, unread: number): void {
    if (socket?.connected) {
        socket.emit('inboxUnreadChanged', { handle, unread });
    } else {
        // Fallback to Custom Events
        window.dispatchEvent(new CustomEvent('inboxUnreadChanged', { 
            detail: { handle, unread } 
        }));
    }
}

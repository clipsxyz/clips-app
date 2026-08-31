import { io, Socket } from 'socket.io-client';
import { getRuntimeEnv } from '../config/runtimeEnv';
import { dispatchBrowserEvent } from '../utils/dispatchBrowserEvent';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
    return socket;
}

export function connectSocket(userHandle: string): Socket | null {
    if (socket?.connected) {
        return socket;
    }

    // Only connect when a Socket.IO server URL is explicitly set (e.g. in .env as VITE_SOCKETIO_URL).
    // When unset, the app works without real-time socket and uses Custom Events fallback — no console spam.
    const serverUrl = (getRuntimeEnv('VITE_SOCKETIO_URL') || '').trim();
    if (!serverUrl) {
        socket = null;
        return null;
    }

    socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 3,
        reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
        console.log('Connected to Socket.IO server');
        socket?.emit('register', { userHandle });
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from Socket.IO server');
    });

    socket.on('connect_error', () => {
        // Silent — optional realtime channel; app works without it.
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
        dispatchBrowserEvent('conversationUpdated', { participants: [from, to], message });
    }
}

export function emitConversationUpdate(data: any): void {
    if (socket?.connected) {
        socket.emit('conversationUpdate', data);
    } else {
        dispatchBrowserEvent('conversationUpdated', data);
    }
}

export function emitInboxUnreadChanged(handle: string, unread: number): void {
    if (socket?.connected) {
        socket.emit('inboxUnreadChanged', { handle, unread });
    } else {
        dispatchBrowserEvent('inboxUnreadChanged', { handle, unread });
    }
}

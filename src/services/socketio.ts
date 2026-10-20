import { io, Socket } from 'socket.io-client';
import { getRuntimeEnv } from '../config/runtimeEnv';
import { dispatchBrowserEvent } from '../utils/dispatchBrowserEvent';

export type LocationFeedRoom = {
    placeId?: string | null;
    location?: string | null;
};

let socket: Socket | null = null;
let registeredHandle: string | null = null;
const joinedLocationRooms = new Map<string, LocationFeedRoom>();
const joinedGroupIds = new Set<string>();

export function getSocket(): Socket | null {
    return socket;
}

export function connectSocket(userHandle: string): Socket | null {
    const handle = (userHandle || '').trim();
    if (!handle) return null;

    if (socket) {
        // Reuse the live/reconnecting instance; just (re-)register if the
        // signed-in handle changed (account switch without a full restart).
        registeredHandle = handle;
        if (socket.connected) {
            socket.emit('register', { userHandle: handle });
        }
        return socket;
    }

    // Only connect when a Socket.IO server URL is explicitly set (e.g. in .env as VITE_SOCKETIO_URL).
    // When unset, the app works without real-time socket and uses Custom Events fallback — no console spam.
    const serverUrl = (getRuntimeEnv('VITE_SOCKETIO_URL') || '').trim();
    if (!serverUrl) {
        socket = null;
        return null;
    }

    registeredHandle = handle;
    socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 3,
        reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
        console.log('Connected to Socket.IO server');
        if (registeredHandle) {
            socket?.emit('register', { userHandle: registeredHandle });
        }
        joinedLocationRooms.forEach((room) => socket?.emit('joinLocationFeed', room));
        joinedGroupIds.forEach((groupId) => socket?.emit('joinGroup', { groupId }));
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
    registeredHandle = null;
    joinedLocationRooms.clear();
    joinedGroupIds.clear();
}

/** Canonical room key used by both client and `socketio-server`. */
export function locationFeedRoomKey({ placeId, location }: LocationFeedRoom): string | null {
    const place = typeof placeId === 'string' ? placeId.trim().toLowerCase() : '';
    if (place) return `place:${place}`;
    const loc = typeof location === 'string' ? location.trim().toLowerCase() : '';
    if (loc) return `loc:${loc}`;
    return null;
}

export function joinLocationFeed(room: LocationFeedRoom): void {
    const key = locationFeedRoomKey(room);
    if (key) joinedLocationRooms.set(key, room);
    if (socket?.connected) socket.emit('joinLocationFeed', room);
}

export function leaveLocationFeed(room: LocationFeedRoom): void {
    const key = locationFeedRoomKey(room);
    if (key) joinedLocationRooms.delete(key);
    if (socket?.connected) socket.emit('leaveLocationFeed', room);
}

export function joinGroupChat(groupId: string, members?: string[]): void {
    const id = (groupId || '').trim();
    if (!id) return;
    joinedGroupIds.add(id);
    if (socket?.connected) socket.emit('joinGroup', { groupId: id, members: members ?? [] });
}

export function leaveGroupChat(groupId: string): void {
    const id = (groupId || '').trim();
    if (!id) return;
    joinedGroupIds.delete(id);
    if (socket?.connected) socket.emit('leaveGroup', { groupId: id });
}

export function emitGroupMessage(
    groupId: string,
    from: string,
    message: unknown,
    members?: string[],
): void {
    const id = (groupId || '').trim();
    if (!id) return;
    const payload = {
        from,
        chatGroupId: id,
        chat_group_id: id,
        message,
        members: members ?? [],
    };
    if (socket?.connected) {
        socket.emit('newMessage', payload);
    } else {
        dispatchBrowserEvent('conversationUpdated', payload);
    }
}

export function emitNewFeedPost(post: unknown, rooms: string[]): void {
    const payload = { post, rooms: rooms.filter((r) => typeof r === 'string' && r.trim()) };
    if (socket?.connected) {
        socket.emit('newFeedPost', payload);
    } else {
        dispatchBrowserEvent('newFeedPost', payload);
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

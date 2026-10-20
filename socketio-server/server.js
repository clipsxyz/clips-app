const { Server } = require('socket.io');
const http = require('http');

const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: '*', // Allow all origins in development - restrict in production
        methods: ['GET', 'POST'],
    },
});

/** userHandle → Set of socket ids (multi-device). */
const userSockets = new Map();
/** groupId → Set of member handles (membership map for fan-out). */
const groupMembers = new Map();

function normalizeHandle(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeRoomPart(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function locationRoomName({ placeId, location } = {}) {
    const place = normalizeRoomPart(placeId);
    if (place) return `location:place:${place}`;
    const loc = normalizeRoomPart(location);
    if (loc) return `location:loc:${loc}`;
    return null;
}

function groupRoomName(groupId) {
    const id = typeof groupId === 'string' ? groupId.trim() : '';
    return id ? `group:${id}` : null;
}

function addUserSocket(handle, socketId) {
    if (!handle) return;
    const set = userSockets.get(handle) || new Set();
    set.add(socketId);
    userSockets.set(handle, set);
}

function removeUserSocket(handle, socketId) {
    if (!handle) return;
    const set = userSockets.get(handle);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) userSockets.delete(handle);
}

function rememberGroupMembers(groupId, handles) {
    if (!groupId) return;
    const set = groupMembers.get(groupId) || new Set();
    (handles || []).forEach((h) => {
        const handle = normalizeHandle(h);
        if (handle) set.add(handle);
    });
    groupMembers.set(groupId, set);
    return set;
}

function emitToHandle(handle, event, payload) {
    const sockets = userSockets.get(handle);
    if (!sockets) return;
    sockets.forEach((id) => io.to(id).emit(event, payload));
}

function emitPresence(room, extra = {}) {
    const roomSet = io.sockets.adapter.rooms.get(room);
    const count = roomSet ? roomSet.size : 0;
    io.to(room).emit('presence', { room, count, ...extra });
}

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('register', (data) => {
        const userHandle = normalizeHandle(data?.userHandle);
        if (!userHandle) return;
        if (socket.userHandle && socket.userHandle !== userHandle) {
            removeUserSocket(socket.userHandle, socket.id);
        }
        socket.userHandle = userHandle;
        addUserSocket(userHandle, socket.id);
        console.log(`User ${userHandle} registered with socket ${socket.id}`);
    });

    socket.on('joinLocationFeed', (data) => {
        const room = locationRoomName(data || {});
        if (!room) return;
        socket.join(room);
        emitPresence(room, { kind: 'location' });
    });

    socket.on('leaveLocationFeed', (data) => {
        const room = locationRoomName(data || {});
        if (!room) return;
        socket.leave(room);
        emitPresence(room, { kind: 'location' });
    });

    socket.on('joinGroup', (data) => {
        const groupId = typeof data?.groupId === 'string' ? data.groupId.trim() : '';
        const room = groupRoomName(groupId);
        if (!room) return;
        const members = Array.isArray(data?.members) ? data.members : [];
        if (socket.userHandle) members.push(socket.userHandle);
        rememberGroupMembers(groupId, members);
        socket.join(room);
        emitPresence(room, { kind: 'group', groupId });
    });

    socket.on('leaveGroup', (data) => {
        const groupId = typeof data?.groupId === 'string' ? data.groupId.trim() : '';
        const room = groupRoomName(groupId);
        if (!room) return;
        socket.leave(room);
        emitPresence(room, { kind: 'group', groupId });
    });

    socket.on('newMessage', (data) => {
        const from = normalizeHandle(data?.from);
        const to = normalizeHandle(data?.to);
        const message = data?.message;
        const chatGroupId =
            (typeof data?.chatGroupId === 'string' && data.chatGroupId.trim()) ||
            (typeof data?.chat_group_id === 'string' && data.chat_group_id.trim()) ||
            '';
        console.log(
            chatGroupId
                ? `Group message from ${from} to ${chatGroupId}`
                : `Message from ${from} to ${to}`,
        );

        if (chatGroupId) {
            const members = rememberGroupMembers(chatGroupId, [
                from,
                ...(Array.isArray(data?.members) ? data.members : []),
            ]);
            const payload = {
                participants: Array.from(members),
                chat_group_id: chatGroupId,
                chatGroupId,
                message,
            };
            const room = groupRoomName(chatGroupId);
            if (room) {
                io.to(room).emit('conversationUpdated', payload);
                io.to(room).emit('newMessage', payload);
            }
            members.forEach((handle) => emitToHandle(handle, 'conversationUpdated', payload));
            members.forEach((handle) => emitToHandle(handle, 'newMessage', payload));
            return;
        }

        const payload = {
            participants: [from, to].filter(Boolean),
            message,
        };
        emitToHandle(to, 'conversationUpdated', payload);
        emitToHandle(to, 'newMessage', payload);
        socket.emit('conversationUpdated', payload);
    });

    socket.on('conversationUpdate', (data) => {
        const participants = Array.isArray(data?.participants) ? data.participants : [];
        const chatGroupId =
            (typeof data?.chatGroupId === 'string' && data.chatGroupId.trim()) ||
            (typeof data?.chat_group_id === 'string' && data.chat_group_id.trim()) ||
            '';
        if (chatGroupId) {
            const room = groupRoomName(chatGroupId);
            if (room) io.to(room).emit('conversationUpdated', data);
            const members = groupMembers.get(chatGroupId);
            if (members) members.forEach((handle) => emitToHandle(handle, 'conversationUpdated', data));
            return;
        }
        participants.forEach((handle) => emitToHandle(normalizeHandle(handle), 'conversationUpdated', data));
    });

    socket.on('inboxUnreadChanged', (data) => {
        const handle = normalizeHandle(data?.handle);
        if (handle) emitToHandle(handle, 'inboxUnreadChanged', data);
    });

    socket.on('newFeedPost', (data) => {
        const post = data?.post;
        if (!post || typeof post !== 'object') return;
        const rooms = new Set();
        (Array.isArray(data?.rooms) ? data.rooms : []).forEach((r) => {
            if (typeof r === 'string' && r.trim()) rooms.add(r.trim());
        });
        const fromPlace = locationRoomName({ placeId: data?.placeId || post.placeId });
        const fromLoc = locationRoomName({
            location: data?.location || post.locationLabel || post.userLocal,
        });
        if (fromPlace) rooms.add(fromPlace.replace(/^location:/, ''));
        if (fromLoc) rooms.add(fromLoc.replace(/^location:/, ''));
        rooms.forEach((key) => {
            const room = key.startsWith('location:') ? key : `location:${key}`;
            io.to(room).emit('newFeedPost', { post, room });
        });
    });

    socket.on('disconnect', () => {
        if (socket.userHandle) {
            removeUserSocket(socket.userHandle, socket.id);
            console.log(`User ${socket.userHandle} disconnected`);
        }
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Socket.IO server running on port ${PORT}`);
});

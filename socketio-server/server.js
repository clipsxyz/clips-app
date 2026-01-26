const { Server } = require('socket.io');
const http = require('http');

const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins in development - restrict in production
        methods: ["GET", "POST"]
    }
});

// Store active connections by user handle
const userSockets = new Map();

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // When a user connects, store their handle
    socket.on('register', (data) => {
        const { userHandle } = data;
        if (userHandle) {
            userSockets.set(userHandle, socket.id);
            socket.userHandle = userHandle;
            console.log(`User ${userHandle} registered with socket ${socket.id}`);
        }
    });

    // Handle new message events
    socket.on('newMessage', (data) => {
        const { from, to, message } = data;
        console.log(`Message from ${from} to ${to}:`, message);

        // Emit to the recipient if they're connected
        const recipientSocketId = userSockets.get(to);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('conversationUpdated', {
                participants: [from, to],
                message: message
            });
            console.log(`Message delivered to ${to}`);
        } else {
            console.log(`Recipient ${to} not connected`);
        }

        // Also emit back to sender for confirmation
        socket.emit('conversationUpdated', {
            participants: [from, to],
            message: message
        });
    });

    // Handle conversation updates (mute, block, delete, etc.)
    socket.on('conversationUpdate', (data) => {
        const { participants, updateType } = data;
        if (participants && participants.length === 2) {
            const [user1, user2] = participants;
            // Notify both users if they're connected
            [user1, user2].forEach(handle => {
                const socketId = userSockets.get(handle);
                if (socketId) {
                    io.to(socketId).emit('conversationUpdated', data);
                }
            });
        }
    });

    // Handle inbox unread count updates
    socket.on('inboxUnreadChanged', (data) => {
        const { handle, unread } = data;
        const socketId = userSockets.get(handle);
        if (socketId) {
            io.to(socketId).emit('inboxUnreadChanged', data);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        if (socket.userHandle) {
            userSockets.delete(socket.userHandle);
            console.log(`User ${socket.userHandle} disconnected`);
        }
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Socket.IO server running on port ${PORT}`);
});

# Socket.IO Setup for Direct Messages

This project now uses Socket.IO for real-time Direct Message communication.

## Setup Instructions

### 1. Start the Socket.IO Server

Using Docker Compose (recommended):
```bash
docker-compose up -d socketio-server
```

Or manually:
```bash
cd socketio-server
npm install
npm start
```

The server will run on port 3001 by default.

### 2. Environment Variables

Add to your `.env` file (optional):
```
VITE_SOCKETIO_URL=http://localhost:3001
```

If not set, it defaults to `http://localhost:3001`.

### 3. How It Works

- **Frontend**: Connects to Socket.IO server when user logs in
- **Messages API**: Emits events via Socket.IO (with fallback to Custom Events)
- **Real-time Updates**: Messages appear instantly across all connected devices/tabs

### 4. Features

- Real-time message delivery
- Cross-device synchronization
- Automatic reconnection
- Fallback to Custom Events if Socket.IO is unavailable

### 5. Docker Container

The Socket.IO server runs in a Docker container:
- **Image**: Built from `socketio-server/Dockerfile`
- **Port**: 3001
- **Network**: `clips-network`

### 6. Troubleshooting

- Check Docker container: `docker ps`
- View logs: `docker-compose logs socketio-server`
- Restart: `docker-compose restart socketio-server`

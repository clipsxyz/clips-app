# Docker Setup for Clips App

This project includes Docker configurations for both the frontend application and the Socket.IO server.

## Quick Start

### Production Build (Full Stack)

Build and run both the frontend app and Socket.IO server:

```bash
docker-compose up -d --build
```

This will:
- Build the React/Vite frontend app
- Build the Socket.IO server
- Start both containers
- Frontend available at: `http://localhost`
- Socket.IO server at: `http://localhost:3001`

**Note**: The frontend is built with `VITE_SOCKETIO_URL=http://localhost:3001` by default. The browser will connect to this URL when accessing the app.

### Development Mode (Socket.IO Only)

If you're running the frontend with `npm run dev` locally, you can just run the Socket.IO server:

```bash
docker-compose -f docker-compose.dev.yml up -d socketio-server
```

## Services

### 1. clips-app (Frontend)
- **Port**: 80
- **Technology**: React + Vite, served via Nginx
- **Build**: Multi-stage Docker build (Node.js builder + Nginx production server)

### 2. socketio-server (Socket.IO)
- **Port**: 3001
- **Technology**: Node.js + Socket.IO
- **Purpose**: Real-time Direct Message communication

## Commands

### Build and Start
```bash
docker-compose up -d --build
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f clips-app
docker-compose logs -f socketio-server
```

### Stop Services
```bash
docker-compose down
```

### Rebuild After Changes
```bash
docker-compose up -d --build
```

### Check Running Containers
```bash
docker-compose ps
```

## Environment Variables

### Frontend (clips-app)
- `VITE_SOCKETIO_URL`: Socket.IO server URL (default: `http://socketio-server:3001`)

### Socket.IO Server
- `PORT`: Server port (default: `3001`)

## Network

Both services run on the `clips-network` bridge network, allowing them to communicate using service names:
- Frontend connects to Socket.IO via: `http://socketio-server:3001`

## Troubleshooting

### Port Already in Use
If port 80 or 3001 is already in use, modify the ports in `docker-compose.yml`:
```yaml
ports:
  - "8080:80"  # Change 80 to 8080
```

### Rebuild After Code Changes
```bash
docker-compose up -d --build --force-recreate
```

### Check Container Status
```bash
docker ps
```

### View Container Logs
```bash
docker logs clips-app
docker logs socketio-dm-server
```

### Access Container Shell
```bash
docker exec -it clips-app sh
docker exec -it socketio-dm-server sh
```

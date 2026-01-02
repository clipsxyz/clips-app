# Music Generation Setup Guide

## Architecture

Your app uses **two services** that work together:

1. **Laravel Backend (PHP)** - Runs on `http://localhost:8000`
   - Handles your main app logic
   - Calls the music service when needed

2. **MusicGen Service (Python)** - Runs on `http://localhost:5000`
   - Generates music using open-source MusicGen
   - PHP calls it via HTTP (like calling any API)

## How It Works

```
User clicks "Generate Music"
    ↓
Laravel (PHP) receives request
    ↓
Laravel calls Python service: http://localhost:5000/generate
    ↓
Python generates music
    ↓
Python returns audio file
    ↓
Laravel saves it and returns to user
```

## Setup Steps

### 1. Install Python (if needed)
- Download from https://www.python.org/downloads/
- Make sure Python 3.8+ is installed
- Verify: `python --version`

### 2. Start Music Service (Terminal 1)
```bash
cd musicgen-service
pip install -r requirements.txt
python app.py
```
**Keep this terminal open** - the service must stay running.

### 3. Start Laravel Backend (Terminal 2)
```bash
cd laravel-backend
php artisan serve
```

### 4. Start Frontend (Terminal 3)
```bash
npm run dev
```

## Running Multiple Services

This is **normal** in development:
- Many apps run multiple services
- Each service has its own terminal/process
- They communicate via HTTP

## Alternative: Run Python Service in Background

On Windows PowerShell:
```powershell
Start-Process python -ArgumentList "app.py" -WorkingDirectory "musicgen-service"
```

Or use a process manager like PM2 (if you install Node.js version).

## Troubleshooting

**"Cannot connect to MusicGen service"**
- Make sure Python service is running on port 5000
- Check: Open http://localhost:5000/health in browser

**Python not found**
- Install Python from python.org
- Make sure it's in your PATH

**Port 5000 already in use**
- Change port in `musicgen-service/app.py`: `port = 5001`
- Update `.env`: `MUSICGEN_SERVICE_URL=http://localhost:5001`





















# Quick Start: Music Generation

## Step 1: Setup Python Service (One-time setup)

Open a terminal in the `musicgen-service` folder:

```bash
cd musicgen-service
python setup.bat
```

Or manually:
```bash
pip install -r requirements.txt
```

**Note:** First time will download the model (~1.5GB). This takes 5-10 minutes.

## Step 2: Start Python Service

Keep this running in a terminal:

```bash
cd musicgen-service
python app.py
```

You should see:
```
MusicGen Service Starting...
Service will run on: http://localhost:5000
```

**Keep this terminal open!** The service must stay running.

## Step 3: Start Laravel Backend

Open a **new terminal**:

```bash
cd laravel-backend
php artisan serve
```

## Step 4: Start Frontend

Open **another terminal**:

```bash
npm run dev
```

## Step 5: Test It!

1. Go to your app
2. Navigate to the music section
3. Click "Generate Music"
4. Select mood and genre
5. Click "Generate"

## Troubleshooting

**"Cannot connect to MusicGen service"**
- Make sure Python service is running (Step 2)
- Check: Open http://localhost:5000/health in browser
- Should show: `{"status":"ok","model":"facebook/musicgen-small"}`

**Python not found**
- Install Python 3.8+ from https://www.python.org/downloads/
- Make sure to check "Add Python to PATH" during installation

**Port 5000 already in use**
- Change port in `musicgen-service/app.py`: `port = 5001`
- Update `laravel-backend/.env`: `MUSICGEN_SERVICE_URL=http://localhost:5001`

**Model download is slow**
- Normal! First time downloads ~1.5GB
- Subsequent runs are instant (model is cached)

## What's Running?

You'll have 3 terminals open:
1. **Python Service** (port 5000) - Generates music
2. **Laravel Backend** (port 8000) - Your PHP API
3. **Frontend** (port 5173) - Your React app

This is normal! They all work together.























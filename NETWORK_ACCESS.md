# Accessing the App from Your Phone

When developing, you can test on your phone by connecting it to the same Wi‑Fi as your laptop.

**Important:** The app automatically uses your laptop's IP for API calls when you open it via `http://192.168.1.x:5173`. You do not need to change any env variables.

## 1. Get Your Laptop's IP Address

**Windows (PowerShell):**
```powershell
ipconfig | findstr "IPv4"
```

**macOS/Linux:**
```bash
ifconfig | grep "inet "
```

Look for something like `192.168.1.5` or `192.168.0.10`.

## 2. Start the Backend for Network Access

The Laravel backend must listen on all interfaces, not just localhost:

```bash
cd laravel-backend
php artisan serve --host=0.0.0.0
```

Without `--host=0.0.0.0`, your phone cannot reach the backend.

## 3. Start the Frontend

```bash
npm run dev
```

Vite is already configured with `host: '0.0.0.0'`, so it accepts connections from your phone.

## 4. Open on Your Phone

Use your laptop's IP in the browser:

```
http://192.168.1.5:5173
```

**Do not use `localhost`** – on your phone, that refers to the phone itself, not your laptop.

## 5. Firewall

If it still doesn't load, allow incoming connections for Node and PHP in Windows Firewall:
- Port **5173** (Vite)
- Port **8000** (Laravel)

## Summary

| Service   | URL on Laptop      | URL on Phone          |
|-----------|--------------------|------------------------|
| Frontend  | http://localhost:5173  | http://192.168.1.5:5173  |
| Backend   | http://localhost:8000  | http://192.168.1.5:8000  |

The app automatically uses the correct API and media URLs when accessed via IP.

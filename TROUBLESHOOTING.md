# Troubleshooting: App Not Loading

If the app won't load on laptop or phone, try these steps.

## 1. Force Mock Mode (Bypass Backend)

If the Laravel backend or database is failing, you can force the app to use mock data:

Add to your root `.env`:
```
VITE_USE_LARAVEL_API=false
```

Restart the dev server (`npm run dev`). The feed will use local/mock posts instead of the API.

## 2. Phone: Use Laptop IP, Not localhost

**Never use `localhost` on your phone** – it refers to the phone, not your laptop.

- ❌ `http://localhost:5173` – wrong on phone
- ✅ `http://192.168.1.5:5173` – use your laptop's IP

Get your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux).

## 3. Backend Must Listen on Network (for Phone)

When testing on phone, start Laravel with:
```bash
cd laravel-backend
php artisan serve --host=0.0.0.0
```

Without `--host=0.0.0.0`, the phone cannot reach the backend.

## 4. Check Browser Console

Open DevTools (F12) → Console. Look for:
- Red errors (JavaScript crashes)
- Failed network requests (API 500s, CORS, connection refused)
- Warnings about Stripe, Firebase, etc.

## 5. Clear Cache

- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Or: DevTools → Application → Clear storage → Clear site data
- On phone: clear browser cache / try incognito

## 6. Common Causes

| Symptom | Likely cause |
|---------|--------------|
| Blank white screen | JS error – check console |
| "Failed to load posts" | Backend down or returning errors |
| Works on laptop, not phone | Using localhost on phone, or backend not on 0.0.0.0 |
| Media "Failed to load" | Invalid URLs, CORS, or backend storage not accessible |

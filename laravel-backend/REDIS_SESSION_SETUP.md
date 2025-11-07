# Redis Session Storage Setup

## ✅ Current Configuration Status

Your Laravel backend is **already configured** to use Redis for session storage!

### Environment Configuration (`env.example`)

```env
SESSION_DRIVER=redis
CACHE_DRIVER=redis
SESSION_LIFETIME=120

REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=null
```

---

## 📦 Required Dependencies

### Option 1: PhpRedis Extension (Recommended for Production)

**PhpRedis** is a PHP extension written in C - faster but requires compilation.

**Installation:**

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install php-redis
sudo systemctl restart php-fpm  # or apache2/nginx
```

**macOS:**
```bash
brew install php-redis
# or
pecl install redis
```

**Windows:**
- Download from: https://windows.php.net/downloads/pecl/releases/redis/
- Or use WSL2 with Ubuntu installation

**Verify Installation:**
```bash
php -m | grep redis
# Should show: redis
```

### Option 2: Predis Package (Recommended for Development)

**Predis** is a pure PHP client - easier to install, no compilation needed.

**Installation:**
```bash
cd laravel-backend
composer require predis/predis
```

**Update `.env`:**
```env
REDIS_CLIENT=predis
```

---

## 🚀 Complete Setup Steps

### 1. Install Redis Server

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Windows:**
- Download from: https://github.com/microsoftarchive/redis/releases
- Or use WSL2: `sudo apt-get install redis-server`

### 2. Verify Redis is Running

```bash
redis-cli ping
# Should return: PONG
```

### 3. Install Redis Client for PHP

**Choose one:**

**A) PhpRedis Extension (Production):**
```bash
# Ubuntu/Debian
sudo apt-get install php-redis

# macOS
pecl install redis

# Then verify
php -m | grep redis
```

**B) Predis Package (Development):**
```bash
cd laravel-backend
composer require predis/predis
```

### 4. Configure Laravel

**Ensure your `.env` file has:**
```env
SESSION_DRIVER=redis
CACHE_DRIVER=redis
SESSION_LIFETIME=120

# Choose one:
REDIS_CLIENT=phpredis  # If using PhpRedis extension
# OR
REDIS_CLIENT=predis    # If using Predis package

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=null
```

**Clear config cache:**
```bash
cd laravel-backend
php artisan config:clear
php artisan cache:clear
```

### 5. Test Redis Connection

```bash
php artisan tinker
```

**In Tinker:**
```php
// Test Redis connection
Redis::connection()->ping();
// Should return: "PONG"

// Test session storage
session(['test_key' => 'test_value']);
session('test_key');
// Should return: "test_value"

// Test cache storage
Cache::put('test_cache', 'cache_value', 60);
Cache::get('test_cache');
// Should return: "cache_value"

// Check session keys in Redis
Redis::connection()->keys('laravel_session:*');
```

---

## 🔧 How Redis Sessions Work

### Session Storage Flow

1. **User logs in** → Laravel creates session in Redis
2. **Session ID** stored in cookie (encrypted)
3. **Session data** stored in Redis with key: `laravel_session:{session_id}`
4. **Session lifetime**: 120 minutes (2 hours) as configured
5. **Automatic expiration**: Redis automatically removes expired sessions

### Session Key Format

```
laravel_session:abc123def456...
```

### Benefits

✅ **Fast**: Much faster than file-based sessions  
✅ **Scalable**: Perfect for multi-server deployments  
✅ **Distributed**: Multiple Laravel instances share the same session store  
✅ **Persistent**: Sessions survive server restarts (if Redis persistence enabled)  
✅ **Memory Efficient**: Automatic expiration of old sessions  

---

## 🔐 Security Considerations

### For Production

1. **Set Redis Password:**
```env
REDIS_PASSWORD=your_secure_password_here
```

2. **Bind Redis to Localhost** (if Redis is on same server):
Edit `/etc/redis/redis.conf`:
```
bind 127.0.0.1
requirepass your_secure_password_here
```

3. **Use SSL/TLS** (if Redis is on remote server):
```env
REDIS_HOST=your-redis-host.com
REDIS_PORT=6380  # SSL port
REDIS_PASSWORD=your_password
REDIS_TLS=true
```

4. **Firewall Rules:**
```bash
# Only allow localhost access
sudo ufw allow from 127.0.0.1 to any port 6379
```

---

## 🧪 Testing Session Storage

### Test Session Creation

```bash
php artisan tinker
```

```php
// Start a session
session(['user_id' => '123', 'username' => 'testuser']);

// Retrieve session data
session('user_id');
// Should return: "123"

// Check Redis directly
Redis::connection()->keys('laravel_session:*');
// Should show session keys
```

### Test Session Persistence

1. **Create session:**
```php
session(['test' => 'persistent_value']);
```

2. **Check Redis:**
```bash
redis-cli
> KEYS laravel_session:*
> GET laravel_session:abc123...
```

3. **Verify expiration:**
```bash
redis-cli
> TTL laravel_session:abc123...
# Should show remaining seconds (max 7200 = 120 minutes)
```

---

## 📊 Monitoring Redis Sessions

### Check Active Sessions

```bash
redis-cli
> KEYS laravel_session:*
> INFO stats
> INFO memory
```

### Monitor Session Operations in Real-Time

```bash
redis-cli MONITOR
```

### Check Session Count

```bash
redis-cli
> KEYS laravel_session:* | wc -l
```

---

## 🚨 Troubleshooting

### Error: "Connection refused"

**Problem**: Redis server is not running

**Solution:**
```bash
# Start Redis
sudo systemctl start redis-server
# or
redis-server

# Verify
redis-cli ping
# Should return: PONG
```

### Error: "Class 'Redis' not found"

**Problem**: PhpRedis extension not installed

**Solution:**
```bash
# Install PhpRedis
sudo apt-get install php-redis
# OR use Predis
composer require predis/predis
# Then update .env: REDIS_CLIENT=predis
```

### Error: "Connection timeout"

**Problem**: Redis not accessible or wrong host/port

**Solution:**
1. Check Redis is running: `redis-cli ping`
2. Verify `.env` has correct `REDIS_HOST` and `REDIS_PORT`
3. Check firewall rules
4. Test connection: `redis-cli -h 127.0.0.1 -p 6379 ping`

### Sessions Not Persisting

**Problem**: Redis not configured correctly

**Solution:**
1. Verify `.env` has `SESSION_DRIVER=redis`
2. Check Redis is running: `redis-cli ping`
3. Clear config cache: `php artisan config:clear`
4. Restart PHP-FPM/Apache: `sudo systemctl restart php-fpm`

### Error: "Predis\Connection\ConnectionException"

**Problem**: Predis can't connect to Redis

**Solution:**
1. Verify Redis is running: `redis-cli ping`
2. Check `.env` has correct `REDIS_HOST` and `REDIS_PORT`
3. If using password, ensure `REDIS_PASSWORD` is set correctly

---

## 📋 Laravel Session Configuration

Laravel's session configuration is handled automatically when you set `SESSION_DRIVER=redis` in `.env`. The framework will:

1. Use Redis as the session driver
2. Store sessions with prefix `laravel_session:`
3. Encrypt session data automatically
4. Set session lifetime from `SESSION_LIFETIME` (120 minutes)
5. Use the Redis connection specified in `config/database.php`

### Custom Session Configuration

If you need to customize session settings, publish the config:

```bash
php artisan config:publish session
```

This creates `config/session.php` where you can customize:
- Session driver
- Session lifetime
- Session encryption
- Cookie settings
- Redis connection name

---

## ✅ Production Checklist

- [ ] Redis server installed and running
- [ ] Redis client installed (PhpRedis OR Predis)
- [ ] `.env` configured with `SESSION_DRIVER=redis`
- [ ] Redis password set (production)
- [ ] Redis bound to localhost (if on same server)
- [ ] Firewall rules configured
- [ ] Session lifetime configured appropriately
- [ ] Redis persistence enabled (optional)
- [ ] Monitoring set up for Redis
- [ ] Backup strategy for Redis data (if needed)

---

## 🎯 Summary

**Status**: ✅ Redis session storage is configured in your Laravel backend

**What's Already Done:**
- ✅ Environment variables configured (`env.example`)
- ✅ Documentation created (`REDIS_CONFIGURATION.md`)

**What You Need to Do:**
1. ✅ Install Redis server
2. ✅ Install Redis client (PhpRedis extension OR Predis package)
3. ✅ Copy `env.example` to `.env` and configure
4. ✅ Test connection
5. ✅ Ready for production!

**Your Laravel backend will use Redis for:**
- ✅ **Session storage** (user sessions, authentication state)
- ✅ **Cache storage** (feed cache, user data, etc.)
- ✅ **Queue storage** (if configured)

This provides fast, scalable session and cache management perfect for production! 🚀


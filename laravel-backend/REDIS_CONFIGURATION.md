# Redis Configuration for Session Storage

## ✅ Current Configuration

Redis is configured for **session storage** and **cache** in your Laravel backend.

### Environment Variables (from `env.example`)

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

## 📦 Required Packages

Laravel uses the **`predis/predis`** or **`phpredis`** extension for Redis. The `env.example` specifies `phpredis` client.

### Option 1: PhpRedis Extension (Recommended for Production)
PhpRedis is a PHP extension written in C, faster but requires compilation:

```bash
# Install PhpRedis extension (varies by OS)
# Ubuntu/Debian:
sudo apt-get install php-redis

# Or compile from source:
pecl install redis
```

### Option 2: Predis Package (Recommended for Development)
Predis is a pure PHP client, easier to install:

```bash
cd laravel-backend
composer require predis/predis
```

Then update `.env`:
```env
REDIS_CLIENT=predis
```

---

## 🚀 Setup Instructions

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
- Or use WSL2 with Ubuntu installation

### 2. Verify Redis is Running

```bash
redis-cli ping
# Should return: PONG
```

### 3. Configure Laravel

**Copy `.env.example` to `.env` if not already done:**
```bash
cd laravel-backend
cp env.example .env
php artisan key:generate
```

**Ensure your `.env` has:**
```env
SESSION_DRIVER=redis
CACHE_DRIVER=redis
REDIS_CLIENT=phpredis  # or predis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=null
```

### 4. Test Redis Connection

```bash
php artisan tinker
```

Then in tinker:
```php
Redis::connection()->ping();
// Should return: "PONG"

Cache::put('test', 'value', 60);
Cache::get('test');
// Should return: "value"
```

---

## 📋 Configuration Files

Laravel's default Redis configuration is in `config/database.php` (Redis section). If you need to customize, publish the config:

```bash
php artisan config:publish database
```

This creates `config/database.php` with Redis configuration including:
- Default connection
- Cache connection
- Session connection
- Queue connection

---

## 🔧 Session Storage with Redis

### How It Works

1. **Session Driver**: Set to `redis` in `.env`
2. **Session Storage**: Sessions stored in Redis with key prefix `laravel_session:`
3. **Session Lifetime**: 120 minutes (2 hours) as configured
4. **Security**: Session data is encrypted by default in Laravel

### Benefits of Redis for Sessions

✅ **Fast**: Much faster than file-based sessions  
✅ **Scalable**: Perfect for multi-server deployments  
✅ **Persistent**: Sessions survive server restarts (if Redis is configured for persistence)  
✅ **Distributed**: Multiple Laravel instances can share the same session store  
✅ **Memory Efficient**: Automatic expiration of old sessions  

---

## 🗄️ Cache Storage with Redis

### How It Works

1. **Cache Driver**: Set to `redis` in `.env`
2. **Cache Storage**: All Laravel cache operations use Redis
3. **Cache Prefix**: Default prefix is `laravel_cache`

### Usage in Your App

```php
// Cache feed data
Cache::put('feed_cache_user_123', $feedData, 3600);

// Cache user data
Cache::remember('user_' . $userId, 3600, function() {
    return User::with('posts')->find($userId);
});
```

---

## 🔐 Security Considerations

### For Production

1. **Set Redis Password**:
```env
REDIS_PASSWORD=your_secure_password_here
```

2. **Bind to Localhost Only** (if Redis is on same server):
Edit `/etc/redis/redis.conf`:
```
bind 127.0.0.1
```

3. **Use SSL/TLS** (if Redis is on remote server):
```env
REDIS_HOST=your-redis-host.com
REDIS_PORT=6380  # SSL port
REDIS_PASSWORD=your_password
REDIS_TLS=true
```

---

## 🧪 Testing Redis Configuration

### Test Session Storage

```bash
php artisan tinker
```

```php
// Start a session
session(['test' => 'value']);

// Check Redis
Redis::connection()->keys('laravel_session:*');
```

### Test Cache Storage

```php
Cache::put('test_key', 'test_value', 60);
Cache::get('test_key');
// Should return: "test_value"
```

---

## 📊 Redis Monitoring

### Check Redis Stats

```bash
redis-cli
> INFO stats
> INFO memory
> KEYS *  # List all keys (use with caution in production)
```

### Monitor Redis Commands in Real-Time

```bash
redis-cli MONITOR
```

---

## 🚨 Troubleshooting

### Error: "Connection refused"

**Problem**: Redis server is not running

**Solution**:
```bash
sudo systemctl start redis-server
# or
redis-server
```

### Error: "Class 'Redis' not found"

**Problem**: PhpRedis extension not installed

**Solution**:
- Install PhpRedis extension, OR
- Use Predis: `composer require predis/predis` and set `REDIS_CLIENT=predis`

### Sessions Not Persisting

**Problem**: Redis not configured correctly

**Solution**:
1. Check `.env` has `SESSION_DRIVER=redis`
2. Verify Redis is running: `redis-cli ping`
3. Clear config cache: `php artisan config:clear`

---

## ✅ Summary

**Status**: ✅ Redis is configured for session and cache storage

**Next Steps**:
1. ✅ Install Redis server
2. ✅ Install Redis client (PhpRedis extension OR Predis package)
3. ✅ Verify `.env` configuration
4. ✅ Test connection
5. ✅ Ready for production!

**Your Laravel backend is configured to use Redis for:**
- ✅ Session storage (user sessions)
- ✅ Cache storage (feed cache, user data, etc.)
- ✅ Queue storage (if configured)

This provides fast, scalable session and cache management for your production environment!


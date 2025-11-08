# Redis Session Storage Setup

## ✅ Current Configuration

Redis is already configured in `env.example`:
- `SESSION_DRIVER=redis`
- `CACHE_DRIVER=redis`
- `REDIS_CLIENT=predis` (or `phpredis` if extension is installed)
- `REDIS_HOST=127.0.0.1`
- `REDIS_PORT=6379`

## 📦 Package Status

✅ **predis/predis** is already added to `composer.json`

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
cd laravel-backend
composer install
```

This will install `predis/predis` automatically.

### 2. Install Redis Server

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Windows:**
- Download from: https://github.com/microsoftarchive/redis/releases
- Or use WSL: `sudo apt-get install redis-server`

### 3. Configure Environment

```bash
cp env.example .env
php artisan key:generate
```

Edit `.env` and ensure:
```env
SESSION_DRIVER=redis
CACHE_DRIVER=redis
REDIS_CLIENT=predis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

### 4. Verify Redis Connection

```bash
# Test Redis is running
redis-cli ping
# Should return: PONG

# Test from Laravel
php artisan tinker
>>> Cache::store('redis')->put('test', 'value', 60);
>>> Cache::store('redis')->get('test');
=> "value"
```

## 🔧 Alternative: phpredis (Faster)

If you want to use the faster `phpredis` extension instead of `predis`:

### Install phpredis Extension

**Ubuntu/Debian:**
```bash
sudo apt-get install php-redis
sudo systemctl restart php8.1-fpm  # or your PHP service
```

**macOS:**
```bash
brew install php-redis
```

**Windows:**
- Use XAMPP/WAMP with Redis extension
- Or compile from source

### Update .env

```env
REDIS_CLIENT=phpredis
```

## 📊 Session Storage Verification

Check that sessions are stored in Redis:

```bash
# Connect to Redis CLI
redis-cli

# List all keys
KEYS *

# Check session keys (Laravel uses 'laravel_session:*' prefix)
KEYS laravel_session:*

# Get a session value
GET laravel_session:your_session_id
```

## ✅ Benefits of Redis Sessions

1. **Performance**: Much faster than file-based sessions
2. **Scalability**: Works across multiple servers
3. **Persistence**: Sessions survive server restarts
4. **Memory**: Efficient memory usage
5. **Expiration**: Automatic cleanup of expired sessions

## 🔍 Troubleshooting

### Redis Connection Failed

```bash
# Check Redis is running
redis-cli ping

# Check Redis port
netstat -an | grep 6379

# Check Laravel config
php artisan config:clear
php artisan cache:clear
```

### Session Not Working

1. Clear config cache: `php artisan config:clear`
2. Check `.env` has `SESSION_DRIVER=redis`
3. Verify Redis is running: `redis-cli ping`
4. Check Redis connection in Laravel: `php artisan tinker` → `Cache::store('redis')->put('test', 'value')`

### Using Different Redis Database

If you want to use a different Redis database for sessions:

```env
REDIS_DB=1  # Use database 1 instead of 0
```

## 📝 Notes

- **predis** is pure PHP and works everywhere (recommended for development)
- **phpredis** requires a PHP extension but is faster (recommended for production)
- Default session lifetime is 120 minutes (2 hours)
- Sessions are automatically cleaned up by Redis when expired

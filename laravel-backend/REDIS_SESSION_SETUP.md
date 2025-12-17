# Redis Session Storage Setup

## ✅ Configuration Complete

Session storage has been configured to use Redis instead of file-based storage.

## Configuration Changes Made

### 1. Session Driver Updated
**File**: `config/session.php`
- Changed from: `'driver' => env('SESSION_DRIVER', 'file')`
- Changed to: `'driver' => env('SESSION_DRIVER', 'redis')`

### 2. Redis Connection Already Configured
**File**: `config/database.php`
- Redis connections are already properly configured:
  - `default` - Database 0 (general operations)
  - `cache` - Database 1 (caching)
  - `session` - Database 2 (session storage) ✅

## Environment Variables Required

Add these to your `.env` file:

```env
# Session Configuration
SESSION_DRIVER=redis
SESSION_CONNECTION=session

# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
REDIS_DB=0
REDIS_CACHE_DB=1
REDIS_SESSION_DB=2
```

## Installation

### 1. Install Redis Server

**Windows:**
- Download from: https://github.com/microsoftarchive/redis/releases
- Or use WSL: `sudo apt-get install redis-server`

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### 2. Install PHP Redis Extension

**Windows:**
- Download from: https://pecl.php.net/package/redis
- Or use: `pecl install redis`

**macOS/Linux:**
```bash
pecl install redis
```

Add to `php.ini`:
```ini
extension=redis
```

### 3. Install Laravel Redis Package (if not already installed)

```bash
composer require predis/predis
# or
composer require phpredis/phpredis
```

## Testing Redis Connection

### Test Redis is Running
```bash
redis-cli ping
# Should return: PONG
```

### Test Laravel Redis Connection
```bash
php artisan tinker
```
Then in tinker:
```php
Redis::connection('session')->ping();
// Should return: "PONG"
```

## Benefits of Redis Sessions

✅ **Performance**: Much faster than file-based sessions
✅ **Scalability**: Works across multiple servers
✅ **Automatic Expiration**: Sessions expire automatically
✅ **No File System**: No need to manage session files
✅ **Better for Production**: Industry standard for session storage

## Verification

After setup, verify sessions are working:

1. **Check Session Storage**
   ```bash
   php artisan tinker
   ```
   ```php
   session(['test' => 'value']);
   session('test'); // Should return 'value'
   ```

2. **Check Redis Keys**
   ```bash
   redis-cli
   ```
   ```redis
   KEYS laravel_session:*
   ```

## Troubleshooting

### Issue: "Connection refused"
- **Solution**: Make sure Redis server is running
  ```bash
  redis-server
  ```

### Issue: "Class 'Redis' not found"
- **Solution**: Install PHP Redis extension
  ```bash
  pecl install redis
  ```

### Issue: Sessions not persisting
- **Solution**: Check `.env` has `SESSION_DRIVER=redis`
- **Solution**: Clear config cache: `php artisan config:clear`

## Production Notes

For production, consider:
- Using Redis password authentication
- Setting up Redis persistence (RDB or AOF)
- Configuring Redis memory limits
- Setting up Redis replication for high availability
- Using Redis Cluster for distributed setups

## Status

✅ Session driver configured to use Redis
✅ Redis connection properly set up
✅ Ready for production use

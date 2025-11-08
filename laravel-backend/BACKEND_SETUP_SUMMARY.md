# Laravel Backend Setup Summary

## ✅ Migrations Status

All database migrations are created and ready:

1. **2024_01_01_000001_create_users_table.php** - Users table
2. **2024_01_01_000002_create_posts_table.php** - Posts table
3. **2024_01_01_000003_create_comments_table.php** - Comments table
4. **2024_01_01_000004_create_post_likes_table.php** - Post likes
5. **2024_01_01_000005_create_comment_likes_table.php** - Comment likes
6. **2024_01_01_000006_create_post_bookmarks_table.php** - Post bookmarks
7. **2024_01_01_000007_create_user_follows_table.php** - User follows
8. **2024_01_01_000008_create_post_shares_table.php** - Post shares
9. **2024_01_01_000009_create_post_views_table.php** - Post views
10. **2024_01_01_000010_create_post_reclips_table.php** - Post reclips
11. **2024_01_01_000011_create_offline_queue_table.php** - Offline queue
12. **2024_01_01_000012_create_feed_cache_table.php** - Feed cache
13. **2024_01_01_000013_harden_constraints.php** - Constraints
14. **2024_01_01_000014_add_original_user_handle_to_posts.php** - Original user handle
15. **2024_01_01_000015_create_notifications_table.php** - Notifications
16. **2024_01_01_000016_create_messages_table.php** - Messages
17. **2024_01_01_000017_create_stories_table.php** - Stories
18. **2024_01_01_000018_create_story_reactions_table.php** - Story reactions
19. **2024_01_01_000019_create_story_replies_table.php** - Story replies
20. **2024_01_01_000020_create_story_views_table.php** - Story views
21. **2024_01_01_000021_create_collections_table.php** - Collections
22. **2024_01_01_000022_create_collection_posts_table.php** - Collection posts
23. **2024_01_01_000023_add_new_post_features.php** - New post features (banner_text, stickers, template_id, media_items, caption, image_text)

## ✅ Seeders Status

Seeders are created and ready:

1. **DatabaseSeeder.php** - Main seeder that calls GazetteerSeeder
2. **GazetteerSeeder.php** - Seeds sample users, posts, comments, notifications, messages, stories

## ✅ Redis Session Configuration

Redis is already configured in `env.example`:

```env
SESSION_DRIVER=redis
CACHE_DRIVER=redis
REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
SESSION_LIFETIME=120
```

## 📋 Setup Instructions

### 1. Install Dependencies

```bash
cd laravel-backend
composer install
```

### 2. Configure Environment

```bash
cp env.example .env
php artisan key:generate
```

Edit `.env` and set:
- Database credentials
- Redis connection (if different from defaults)
- Session driver: `SESSION_DRIVER=redis`

### 3. Install Redis PHP Extension

**Option A: phpredis (Recommended - faster)**
```bash
# On Ubuntu/Debian
sudo apt-get install php-redis

# On macOS with Homebrew
brew install php-redis

# On Windows
# Download from PECL or use XAMPP/WAMP with Redis extension
```

**Option B: predis (Pure PHP - no extension needed)**
```bash
composer require predis/predis
```

Then set in `.env`:
```env
REDIS_CLIENT=predis
```

### 4. Start Redis Server

**On Ubuntu/Debian:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**On macOS:**
```bash
brew install redis
brew services start redis
```

**On Windows:**
- Download Redis from: https://github.com/microsoftarchive/redis/releases
- Or use WSL with Redis

### 5. Run Migrations

```bash
php artisan migrate
```

### 6. Seed Database (Optional)

```bash
php artisan db:seed
```

### 7. Verify Redis Session

Test that sessions are working:
```bash
php artisan tinker
>>> config('session.driver')
=> "redis"
>>> Cache::store('redis')->put('test', 'value', 60);
>>> Cache::store('redis')->get('test');
=> "value"
```

## 🔍 Verification Checklist

- [ ] Redis server is running
- [ ] PHP Redis extension (phpredis) or predis package is installed
- [ ] `.env` has `SESSION_DRIVER=redis`
- [ ] `.env` has correct `REDIS_HOST` and `REDIS_PORT`
- [ ] Migrations run successfully: `php artisan migrate`
- [ ] Seeders run successfully: `php artisan db:seed`
- [ ] Sessions are stored in Redis (check with `redis-cli`)

## 📝 Notes

- **phpredis** is faster but requires a PHP extension
- **predis** is pure PHP and easier to install but slightly slower
- Default Redis port is 6379
- Session lifetime is set to 120 minutes (2 hours)
- All new post features (banner, stickers, templates, carousel) are included in migration 000023


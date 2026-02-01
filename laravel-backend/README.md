# Laravel Backend - Gazetteer Social Media App

## ✅ Status: **COMPLETE WITH RELATIONSHIPS**

All migrations, models, and controllers are set up with proper Eloquent relationships.

## 📊 Migrations Created

All 14 migration files are in `database/migrations/`:

1. `2024_01_01_000001_create_users_table.php` - Users table
2. `2024_01_01_000002_create_posts_table.php` - Posts table
3. `2024_01_01_000003_create_comments_table.php` - Comments table
4. `2024_01_01_000004_create_post_likes_table.php` - Post likes
5. `2024_01_01_000005_create_comment_likes_table.php` - Comment likes
6. `2024_01_01_000006_create_post_bookmarks_table.php` - Post bookmarks
7. `2024_01_01_000007_create_user_follows_table.php` - User follows
8. `2024_01_01_000008_create_post_shares_table.php` - Post shares
9. `2024_01_01_000009_create_post_views_table.php` - Post views
10. `2024_01_01_000010_create_post_reclips_table.php` - Post reclips
11. `2024_01_01_000011_create_offline_queue_table.php` - Offline queue
12. `2024_01_01_000012_create_feed_cache_table.php` - Feed cache (superseded: see below)
13. `2025_02_01_000001_drop_feed_cache_table.php` - **Drops** `feed_cache`; feed is now cached via Laravel Cache (Memcached)
14. `2024_01_01_000013_harden_constraints.php` - Additional constraints
15. `2024_01_01_000014_add_original_user_handle_to_posts.php` - Adds `original_user_handle` field

### Cache (feed)

- The **feed_cache** table has been removed. Feed responses are cached using **Laravel Cache** with **Memcached**.
- **Production:** set `CACHE_DRIVER=memcached` in `.env` and run Memcached.
- **Local dev:** default is `file`; set `CACHE_DRIVER=memcached` when Memcached is running.
- Optional Memcached `.env` vars: `MEMCACHED_HOST`, `MEMCACHED_PORT` (default `127.0.0.1`, `11211`).

## 🔗 Eloquent Relationships Defined

### User Model (`app/Models/User.php`)
- ✅ `hasMany(Post)` - User has many posts
- ✅ `hasMany(Comment)` - User has many comments
- ✅ `belongsToMany(Post, 'post_likes')` - User likes posts
- ✅ `belongsToMany(Comment, 'comment_likes')` - User likes comments
- ✅ `belongsToMany(Post, 'post_bookmarks')` - User bookmarks posts
- ✅ `belongsToMany(Post, 'post_shares')` - User shares posts
- ✅ `belongsToMany(Post, 'post_views')` - User views posts
- ✅ `belongsToMany(Post, 'post_reclips')` - User reclips posts
- ✅ `belongsToMany(User, 'user_follows', 'follower_id', 'following_id')` - User follows users
- ✅ `belongsToMany(User, 'user_follows', 'following_id', 'follower_id')` - User has followers

### Post Model (`app/Models/Post.php`)
- ✅ `belongsTo(User)` - Post belongs to user (author)
- ✅ `hasMany(Comment)` - Post has many comments
- ✅ `belongsToMany(User, 'post_likes')` - Post is liked by users
- ✅ `belongsToMany(User, 'post_bookmarks')` - Post is bookmarked by users
- ✅ `belongsToMany(User, 'post_shares')` - Post is shared by users
- ✅ `belongsToMany(User, 'post_views')` - Post is viewed by users
- ✅ `belongsToMany(User, 'post_reclips')` - Post is reclipped by users
- ✅ `belongsTo(Post, 'original_post_id')` - Post belongs to original post (for reclips)
- ✅ `hasMany(Post, 'original_post_id')` - Post has many reclipped versions
- ✅ **Updated** - Added `original_user_handle` to fillable array

### Comment Model (`app/Models/Comment.php`)
- ✅ `belongsTo(Post)` - Comment belongs to post
- ✅ `belongsTo(User)` - Comment belongs to user (author)
- ✅ `belongsTo(Comment, 'parent_id')` - Comment belongs to parent comment (replies)
- ✅ `hasMany(Comment, 'parent_id')` - Comment has many replies
- ✅ `belongsToMany(User, 'comment_likes')` - Comment is liked by users

## 🎯 Controllers Updated

### PostController
- ✅ Added `user_reclipped` flag to all post responses
- ✅ Updated reclip method to include `original_user_handle`
- ✅ Added check to prevent reclipping own posts
- ✅ Returns updated original post if already reclipped

### UserController
- ✅ Added `user_reclipped` flag to user profile posts

## 📝 Seeder Available

- `database/seeders/GazetteerSeeder.php` - Seeds sample users, posts, and comments

## 🚀 Running the server

From the `laravel-backend` folder:

```powershell
# Windows PowerShell (use ; not &&)
cd laravel-backend
php artisan serve
```

Server runs at **http://127.0.0.1:8000**.

## 🚀 Running Migrations and Seeders

```bash
# Run all migrations
php artisan migrate

# Run migrations and seeders together
php artisan migrate --seed

# Or run seeders separately
php artisan db:seed
```

## ✅ All Relationships Verified

All Eloquent relationships are properly defined in the models and match the database schema. The controllers use these relationships to:
- Load related data efficiently
- Check user interactions (liked, bookmarked, reclipped, following)
- Maintain data integrity with foreign keys and cascade deletes

The Laravel backend is production-ready! 🎉


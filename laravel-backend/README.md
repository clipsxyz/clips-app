# Laravel Backend - Gazetteer Social Media App

## ✅ Status: **COMPLETE WITH RELATIONSHIPS**

All migrations, models, and controllers are set up with proper Eloquent relationships and match the database schema. **Yes: the backend controllers and models are still set up to work with the database schema—when you go live you can just swap out the mock API** (see **Going live** below). Migrations and seed files have been created for Laravel (see **Migrations** and **Seeders** below).

## 📊 Migrations Created

All migration files are in `database/migrations/`. Core tables and follow-ups include:

- **Core:** `create_users_table`, `create_posts_table`, `create_comments_table`
- **Interactions:** `create_post_likes_table`, `create_comment_likes_table`, `create_post_bookmarks_table`, `create_post_shares_table`, `create_post_views_table`, `create_post_reclips_table`
- **Social:** `create_user_follows_table`, `add_status_to_user_follows_table` (pending/accepted), `add_is_private_to_users_table`
- **Content:** `add_original_user_handle_to_posts`, `add_tagged_users_to_posts` (post_tagged_users), `add_new_post_features`, `add_edit_timeline_to_posts`, `add_video_captions_and_subtitles_to_posts`, `add_text_style_and_stickers_to_stories`
- **Stories / Messages / Notifications:** `create_stories_table`, `create_story_reactions_table`, `create_story_replies_table`, `create_story_views_table`, `create_messages_table` (with `add_read_at_to_messages_table`), `create_notifications_table`, `create_notification_preferences_table`
- **Collections / Media / Jobs:** `create_collections_table`, `create_collection_posts_table`, `create_music_table`, `create_render_jobs_table`, `add_render_job_id_to_posts`, `add_music_track_id_to_posts`, `add_license_fields_to_music`, `add_soft_deletes_to_posts_table`, `add_soft_deletes_to_users_table`
- **Other:** `create_fcm_tokens_table`, `create_offline_queue_table`, `drop_feed_cache_table`, `harden_constraints`, `create_boosts_table`

Feed responses are cached via **Laravel Cache** (configurable: `file`, `redis`, or `memcached` in `.env`).

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

## 📝 Seeders

- **`database/seeders/DatabaseSeeder.php`** – Calls `GazetteerSeeder` (and can call others).
- **`database/seeders/GazetteerSeeder.php`** – Seeds users (e.g. Ava@galway, Sarah@Artane, Bob@Ireland), posts, comments, notifications, messages, stories, story reactions/replies/views, and follow relationship (e.g. Ava follows Barry).
- **`database/seeders/EnsureAvaFollowsBarrySeeder.php`** – Ensures Ava follows Barry (for mutual-follow DM).
- **`database/seeders/MusicLibrarySeeder.php`** – Seeds music library data.

Run all: `php artisan migrate --seed` or `php artisan db:seed`.

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

---

## 🚀 Going live (swap out mock API)

The frontend uses a **mock API** when `VITE_USE_LARAVEL_API=false` (e.g. in `.env.local`). To go live with the real backend:

1. **Backend:** Run migrations and (optionally) seeders: `php artisan migrate --seed`. Ensure Redis (and optionally queue/cache) are configured for production.
2. **Frontend:** Set `VITE_USE_LARAVEL_API=true` (or remove `VITE_USE_LARAVEL_API=false`) and point the app at your Laravel API URL (e.g. `VITE_API_URL=https://your-api.example.com/api` or use the same origin proxy).
3. **Auth:** Ensure Laravel Sanctum / auth is configured so the frontend can send the auth token and the backend accepts it (CORS, cookie domain, etc.).

Controllers and models are already set up to work with the database schema; no backend code change is required to “switch” from mock to live—only frontend env and deployment.

---

## 📦 Redis for session storage

Sessions are configured to use **Redis** by default:

- **`config/session.php`:** `'driver' => env('SESSION_DRIVER', 'redis')`, `'connection' => env('SESSION_CONNECTION', 'session')`.
- **`config/database.php`:** Redis connection `session` uses database index `REDIS_SESSION_DB` (default `2`).

To use Redis for sessions:

1. Install and run Redis.
2. In `.env` set:
   - `SESSION_DRIVER=redis`
   - `SESSION_CONNECTION=session` (optional; this is the default in config)
   - `REDIS_HOST=127.0.0.1` (or your Redis host)
   - `REDIS_PORT=6379`
   - `REDIS_PASSWORD=null` (or your password)
   - `REDIS_SESSION_DB=2` (optional; keeps sessions in a separate DB index)

If Redis is not available, set `SESSION_DRIVER=file` (or `database` / `cookie`) in `.env` so the app still runs.

---

## Query Profiler (Dev)

API responses include query profiling headers in `local` / `testing` by default (or when `QUERY_PROFILER_ENABLED=true`).

### Response headers

- `X-Query-Count`: number of SQL queries executed
- `X-Query-Time-Ms`: total SQL time in milliseconds
- `X-Request-Time-Ms`: total request duration in milliseconds
- `X-Slowest-Query-Ms`: slowest single SQL query time in milliseconds
- `X-Slowest-Query`: truncated SQL text for the slowest query

### Environment variables

Add/tune these in `.env`:

```env
QUERY_PROFILER_ENABLED=false
QUERY_PROFILER_LOG_QUERY_COUNT_THRESHOLD=25
QUERY_PROFILER_LOG_SLOWEST_MS_THRESHOLD=50
QUERY_PROFILER_LOG_TOTAL_MS_THRESHOLD=120
QUERY_PROFILER_LOG_REQUEST_MS_THRESHOLD=500
```

When any threshold is exceeded, the backend logs a warning with request path, query stats, and slowest SQL preview.

### Quick check

```powershell
curl -i "http://127.0.0.1:8000/api/posts?limit=10"
curl -i "http://127.0.0.1:8000/api/users/Ava@galway"
curl -i "http://127.0.0.1:8000/api/posts/{POST_ID}/comments"
```

Inspect the `X-Query-*` headers and compare endpoints before/after changes.

---

## Feed Cursor Pagination

`GET /api/posts` uses keyset cursor pagination.

- Send `cursor` as an opaque token returned by `nextCursor`.
- `nextCursor` can be a string token (new keyset mode) or numeric value (legacy compatibility).
- Treat `nextCursor` as opaque and pass it back exactly as received.

Example:

```http
GET /api/posts?filter=Dublin&limit=10&cursor=MjAyNi0wNC0yMiAxMTozNjo1OXwzZjQw...
```

```json
{
  "items": [/* ... */],
  "nextCursor": "MjAyNi0wNC0yMiAxMTozNToyNXxhYjEy...",
  "hasMore": true
}
```

## Stories Cursor Pagination (Optional)

For large story datasets, use:

```http
GET /api/stories/paged?limit=20&cursor=<opaque-token>&userId=<viewer-id>
```

Response:

```json
{
  "items": [/* flat stories, newest first */],
  "nextCursor": "MjAyNi0wNC0yMiAxMTozNToyNXxhYjEy...",
  "hasMore": true
}
```

The legacy grouped endpoint `GET /api/stories` is unchanged for existing UI flows.

## Notifications Cursor Pagination

`GET /api/notifications` supports keyset cursor pagination:

```http
GET /api/notifications?limit=20&cursor=<opaque-token>
```

Response:

```json
{
  "items": [/* ... */],
  "nextCursor": "MjAyNi0wNC0yMiAxMTozNToyNXxhYjEy...",
  "hasMore": true
}
```

`GET /api/notifications/unread-count`, `POST /api/notifications/{id}/read`, and `POST /api/notifications/mark-all-read` are also available.

## Followers / Following Cursor Pagination

Both endpoints support keyset cursor pagination with opaque `nextCursor` tokens:

- `GET /api/users/{handle}/followers?limit=40&cursor=<opaque-token>`
- `GET /api/users/{handle}/following?limit=40&cursor=<opaque-token>`

Response shape remains:

```json
{
  "items": [/* ... */],
  "nextCursor": "MjAyNi0wNC0yMiAxMTozNToyNXxhYjEy...",
  "hasMore": true
}
```

## Message Thread Cursor Pagination (Optional)

Conversation list uses cursor pagination at `GET /api/messages/conversations`.

For large thread histories, use:

- `GET /api/messages/conversation/{otherHandle}/paged?limit=50&cursor=<opaque-token>`
- `GET /api/messages/group/{groupId}/paged?limit=50&cursor=<opaque-token>`

Each returns:

```json
{
  "items": [/* messages, ascending by time */],
  "nextCursor": "MjAyNi0wNC0yMiAxMTozNToyNXxhYjEy...",
  "hasMore": true
}
```

Legacy endpoints (`/messages/conversation/{otherHandle}` and `/messages/group/{groupId}`) remain unchanged.


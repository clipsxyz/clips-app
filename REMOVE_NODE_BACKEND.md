# Removing Node.js Backend - Keep Laravel Only

## ✅ Updates Complete

### 1. Frontend Updated
- ✅ `src/api/client.ts` - Changed from `localhost:3000` → `localhost:8000`
- ✅ `src/api/locations.ts` - Changed from `localhost:3000` → `localhost:8000`

### 2. Laravel Backend Updated
- ✅ Created `LocationController.php` - Handles location search
- ✅ Created `SearchController.php` - Handles unified search (users, locations, posts)
- ✅ Updated `routes/api.php` - Added location and search routes

### 3. Node.js Backend - Ready to Remove
The `backend/` directory can now be safely removed or archived.

## 📋 To Complete Setup

### 1. Copy Location Data to Laravel
```bash
# Copy locations.json to Laravel storage
cp backend/data/locations.json laravel-backend/storage/app/data/locations.json
```

### 2. Start Laravel Backend
```bash
cd laravel-backend
php artisan serve
# Laravel runs on http://localhost:8000 by default
```

### 3. Update Frontend Environment Variable (Optional)
Create/update `.env` file in root:
```
VITE_API_URL=http://localhost:8000/api
```

### 4. Remove Node.js Backend
```bash
# Option A: Archive it
mv backend backend-nodejs-archive

# Option B: Delete it (if you're sure)
rm -rf backend
```

## ✅ All Endpoints Now Available in Laravel

- `/api/health` - Health check
- `/api/auth/register` - Register
- `/api/auth/login` - Login
- `/api/auth/me` - Get current user
- `/api/auth/logout` - Logout
- `/api/posts` - Get/Create posts
- `/api/posts/{id}` - Get single post
- `/api/posts/{id}/like` - Toggle like
- `/api/posts/{id}/view` - Increment view
- `/api/posts/{id}/share` - Share post
- `/api/posts/{id}/reclip` - Reclip post
- `/api/comments/post/{postId}` - Get/Add comments
- `/api/comments/reply/{parentId}` - Add reply
- `/api/comments/{id}/like` - Toggle comment like
- `/api/users/{handle}` - Get user profile
- `/api/users/{handle}/follow` - Toggle follow
- `/api/users/{handle}/followers` - Get followers
- `/api/users/{handle}/following` - Get following
- `/api/upload/single` - Upload file
- `/api/upload/multiple` - Upload multiple files
- `/api/locations/search` - Search locations (NEW)
- `/api/search` - Unified search (NEW)

## 🎉 You Now Have Only One Backend - Laravel!


# Laravel Gazetteer Backend Setup Guide

## 🚀 Complete Laravel Backend with Eloquent ORM

### Prerequisites
- PHP 8.1+
- Composer
- PostgreSQL 14+
- Node.js (for frontend)

## 📊 Database Setup

1. **Install PostgreSQL**
   ```bash
   # Windows (using Chocolatey)
   choco install postgresql
   
   # macOS (using Homebrew)
   brew install postgresql
   
   # Ubuntu/Debian
   sudo apt install postgresql postgresql-contrib
   ```

2. **Create Database**
   ```bash
   # Connect to PostgreSQL
   psql -U postgres
   
   # Create database
   CREATE DATABASE gazetteer;
   CREATE USER gazetteer_user WITH PASSWORD 'gazetteer123';
   GRANT ALL PRIVILEGES ON DATABASE gazetteer TO gazetteer_user;
   \q
   ```

## 🔧 Laravel Backend Setup

1. **Install Dependencies**
   ```bash
   cd laravel-backend
   composer install
   ```

2. **Configure Environment**
   ```bash
   cp env.example .env
   php artisan key:generate
   ```

3. **Run Migrations**
   ```bash
   php artisan migrate
   ```

4. **Seed Database**
   ```bash
   php artisan db:seed --class=GazetteerSeeder
   ```

5. **Start Laravel Server**
   ```bash
   php artisan serve
   # Server runs on http://localhost:8000
   ```

## 🎨 Frontend Setup

1. **Update Frontend API URL**
   ```bash
   # In your main project root
   echo "VITE_API_URL=http://localhost:8000/api" > .env
   ```

2. **Start Frontend**
   ```bash
   npm run dev
   # App runs on http://localhost:5173
   ```

## 📊 Laravel Models Created

### **Core Models:**
- **`User`** - User authentication and profiles
- **`Post`** - Posts with media and location
- **`Comment`** - Comments with nested replies

### **Interaction Models:**
- **`PostLike`** - Post likes
- **`CommentLike`** - Comment likes
- **`PostBookmark`** - Saved posts
- **`UserFollow`** - Follow relationships
- **`PostShare`** - Share tracking
- **`PostView`** - View tracking
- **`PostReclip`** - Reclip functionality

## 🎯 Laravel Controllers Created

### **API Controllers:**
- **`AuthController`** - Register, login, logout, profile
- **`PostController`** - CRUD operations, likes, views, shares, reclips
- **`CommentController`** - Comments and nested replies
- **`UserController`** - Profiles, follow/unfollow
- **`UploadController`** - File upload handling

## 🔗 API Endpoints

### **Authentication:**
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### **Posts:**
- `GET /api/posts` - Get posts with pagination
- `POST /api/posts` - Create post
- `GET /api/posts/{id}` - Get single post
- `POST /api/posts/{id}/like` - Toggle like
- `POST /api/posts/{id}/view` - Increment view
- `POST /api/posts/{id}/share` - Share post
- `POST /api/posts/{id}/reclip` - Reclip post

### **Comments:**
- `GET /api/comments/post/{postId}` - Get comments
- `POST /api/comments/post/{postId}` - Add comment
- `POST /api/comments/reply/{parentId}` - Add reply
- `POST /api/comments/{id}/like` - Toggle comment like

### **Users:**
- `GET /api/users/{handle}` - Get user profile
- `POST /api/users/{handle}/follow` - Toggle follow
- `GET /api/users/{handle}/followers` - Get followers
- `GET /api/users/{handle}/following` - Get following

### **Upload:**
- `POST /api/upload/single` - Upload single file
- `POST /api/upload/multiple` - Upload multiple files

## 🔄 Eloquent Relationships

### **User Model:**
```php
// Relationships
public function posts() { return $this->hasMany(Post::class); }
public function comments() { return $this->hasMany(Comment::class); }
public function followers() { return $this->belongsToMany(User::class, 'user_follows', 'following_id', 'follower_id'); }
public function following() { return $this->belongsToMany(User::class, 'user_follows', 'follower_id', 'following_id'); }

// Helper methods
public function isFollowing(User $user) { return $this->following()->where('following_id', $user->id)->exists(); }
public function hasLikedPost(Post $post) { return $this->postLikes()->where('post_id', $post->id)->exists(); }
```

### **Post Model:**
```php
// Relationships
public function user() { return $this->belongsTo(User::class); }
public function comments() { return $this->hasMany(Comment::class); }
public function likes() { return $this->belongsToMany(User::class, 'post_likes'); }

// Scopes
public function scopeNotReclipped($query) { return $query->where('is_reclipped', false); }
public function scopeByLocation($query, $location) { return $query->where('location_label', 'LIKE', "%{$location}%"); }
```

### **Comment Model:**
```php
// Relationships
public function post() { return $this->belongsTo(Post::class); }
public function user() { return $this->belongsTo(User::class); }
public function parent() { return $this->belongsTo(Comment::class, 'parent_id'); }
public function replies() { return $this->hasMany(Comment::class, 'parent_id'); }

// Scopes
public function scopeTopLevel($query) { return $query->whereNull('parent_id'); }
public function scopeReplies($query) { return $query->whereNotNull('parent_id'); }
```

## 🚀 Key Features

### **Eloquent ORM Benefits:**
- **Automatic relationships** - No manual JOINs needed
- **Model scopes** - Reusable query logic
- **Mass assignment protection** - Secure data handling
- **Automatic timestamps** - Created/updated tracking
- **Database agnostic** - Easy to switch databases

### **Laravel Features:**
- **Sanctum authentication** - Token-based auth
- **Request validation** - Built-in validation
- **Database transactions** - Data consistency
- **CORS support** - Cross-origin requests
- **File uploads** - Secure file handling

## 🧪 Testing

1. **Test API Endpoints**
   ```bash
   # Health check
   curl http://localhost:8000/api/health
   
   # Register user
   curl -X POST http://localhost:8000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"test","email":"test@example.com","password":"password123","password_confirmation":"password123","displayName":"Test User","handle":"testuser"}'
   ```

2. **Test Frontend**
   - Open http://localhost:5173
   - Register new account
   - Create posts, comments, replies
   - Test all features

## 📈 Performance Features

- **Eager loading** - Prevent N+1 queries
- **Database indexes** - Optimized queries
- **Query scopes** - Reusable filters
- **Pagination** - Efficient data loading
- **Caching** - Built-in Laravel caching

## 🔒 Security Features

- **CSRF protection** - Cross-site request forgery
- **SQL injection prevention** - Eloquent ORM protection
- **Mass assignment protection** - Fillable/guarded attributes
- **Authentication middleware** - Protected routes
- **Request validation** - Input sanitization

Your Laravel backend is now ready with full Eloquent ORM support! 🎉

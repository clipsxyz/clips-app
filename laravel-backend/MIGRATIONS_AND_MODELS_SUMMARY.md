# Database Migrations and Eloquent Models - Complete Summary

## ✅ All Migrations Created

### Core Tables (Existing)
1. **users** - User accounts with bio, avatar, location, social links
2. **posts** - Post content with media, text, location, tags
3. **comments** - Comments with nested replies support
4. **post_likes** - Like tracking
5. **comment_likes** - Comment like tracking
6. **post_bookmarks** - Bookmark tracking
7. **user_follows** - Follow relationships
8. **post_shares** - Share tracking
9. **post_views** - View tracking
10. **post_reclips** - Reclip tracking
11. **offline_queue** - Offline action queue
12. **feed_cache** - Feed caching

### New Tables (Just Added)
13. **notifications** - User notifications (sticker, reply, dm, like, comment, follow)
14. **messages** - Direct messages/conversations
15. **stories** - 24-hour stories/clips
16. **story_reactions** - Story emoji reactions
17. **story_replies** - Story text replies
18. **story_views** - Story view tracking

## ✅ All Eloquent Models Created

### Core Models (Existing)
- **User** - Complete with all relationships
- **Post** - Complete with all relationships
- **Comment** - Complete with all relationships

### New Models (Just Added)
- **Notification** - With relationships to User, Post, Comment
- **Message** - With relationships to User (sender/recipient by handle)
- **Story** - With relationships to User, Post, StoryReaction, StoryReply, StoryView
- **StoryReaction** - With relationships to Story, User
- **StoryReply** - With relationships to Story, User
- **StoryView** - With relationships to Story, User

## ✅ Relationships Defined

### User Model Relationships
- `posts()` - hasMany
- `comments()` - hasMany
- `followers()` - belongsToMany
- `following()` - belongsToMany
- `postLikes()` - belongsToMany
- `commentLikes()` - belongsToMany
- `bookmarks()` - belongsToMany
- `shares()` - belongsToMany
- `views()` - belongsToMany
- `reclips()` - belongsToMany
- **`notifications()` - hasMany** ✨ NEW
- **`unreadNotifications()` - hasMany** ✨ NEW
- **`sentMessages()` - hasMany** ✨ NEW
- **`receivedMessages()` - hasMany** ✨ NEW
- **`conversations()` - query builder** ✨ NEW
- **`stories()` - hasMany** ✨ NEW
- **`activeStories()` - hasMany** ✨ NEW
- **`storyViews()` - hasMany** ✨ NEW
- **`storyReactions()` - hasMany** ✨ NEW
- **`storyReplies()` - hasMany** ✨ NEW

### Post Model Relationships
- `user()` - belongsTo
- `comments()` - hasMany
- `likes()` - belongsToMany
- `bookmarks()` - belongsToMany
- `shares()` - belongsToMany
- `views()` - belongsToMany
- `reclips()` - belongsToMany
- `originalPost()` - belongsTo
- `reclippedPosts()` - hasMany
- **`notifications()` - hasMany** ✨ NEW
- **`sharedAsStories()` - hasMany** ✨ NEW

### Comment Model Relationships
- `post()` - belongsTo
- `user()` - belongsTo
- `parent()` - belongsTo
- `replies()` - hasMany
- `likes()` - belongsToMany
- **`notifications()` - hasMany** ✨ NEW

### Notification Model Relationships
- `user()` - belongsTo (recipient)
- `post()` - belongsTo (optional)
- `comment()` - belongsTo (optional)

### Message Model Relationships
- `sender()` - belongsTo (User by handle)
- `recipient()` - belongsTo (User by handle)

### Story Model Relationships
- `user()` - belongsTo
- `sharedFromPost()` - belongsTo (optional)
- `reactions()` - hasMany (StoryReaction)
- `replies()` - hasMany (StoryReply)
- `views()` - hasMany (StoryView)

### StoryReaction, StoryReply, StoryView Models
- All have relationships to `story()` and `user()`

## 📋 Migration Files Summary

### New Migration Files Created:
1. `2024_01_01_000015_create_notifications_table.php`
2. `2024_01_01_000016_create_messages_table.php`
3. `2024_01_01_000017_create_stories_table.php`
4. `2024_01_01_000018_create_story_reactions_table.php`
5. `2024_01_01_000019_create_story_replies_table.php`
6. `2024_01_01_000020_create_story_views_table.php`

## 🎯 Key Features

### Notifications Table
- Supports types: sticker, reply, dm, like, comment, follow
- Tracks read/unread status
- Links to posts and comments when applicable
- Indexed for performance (user_id, read, created_at)

### Messages Table
- Uses conversation_id (sorted handle pair: "handle1|handle2")
- Supports text and image messages
- System message flag for automated messages
- Indexed for conversation queries

### Stories Table
- 24-hour expiration support (expires_at timestamp)
- Media support (image/video)
- Text overlay support (text, text_color, text_size)
- Location support
- Share from post support
- Active/expired scopes

### Story Interactions
- Reactions (emoji)
- Replies (text)
- Views (tracking)

## 🚀 Next Steps

To run the migrations:
```bash
cd laravel-backend
php artisan migrate
```

All relationships are properly defined and ready to use in your Laravel controllers and API endpoints!


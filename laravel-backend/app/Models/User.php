<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'username',
        'email',
        'password',
        'display_name',
        'handle',
        'bio',
        'avatar_url',
        'social_links', // JSON field for social media links
        'location_local',
        'location_regional',
        'location_national',
        'is_verified',
        'is_private',
        'followers_count',
        'following_count',
        'posts_count',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'is_verified' => 'boolean',
        'is_private' => 'boolean',
        'followers_count' => 'integer',
        'following_count' => 'integer',
        'posts_count' => 'integer',
        'social_links' => 'array', // Cast JSON to array
    ];

    // Relationships
    public function posts()
    {
        return $this->hasMany(Post::class);
    }

    public function comments()
    {
        return $this->hasMany(Comment::class);
    }

    public function followers()
    {
        return $this->belongsToMany(User::class, 'user_follows', 'following_id', 'follower_id')
                    ->wherePivot('status', 'accepted')
                    ->withTimestamps();
    }

    public function following()
    {
        return $this->belongsToMany(User::class, 'user_follows', 'follower_id', 'following_id')
                    ->wherePivot('status', 'accepted')
                    ->withTimestamps();
    }

    public function followRequests()
    {
        return $this->belongsToMany(User::class, 'user_follows', 'following_id', 'follower_id')
                    ->wherePivot('status', 'pending')
                    ->withTimestamps();
    }

    public function pendingFollowRequests()
    {
        return $this->belongsToMany(User::class, 'user_follows', 'follower_id', 'following_id')
                    ->wherePivot('status', 'pending')
                    ->withTimestamps();
    }

    public function postLikes()
    {
        return $this->belongsToMany(Post::class, 'post_likes')
                    ->withTimestamps();
    }

    public function commentLikes()
    {
        return $this->belongsToMany(Comment::class, 'comment_likes')
                    ->withTimestamps();
    }

    public function bookmarks()
    {
        return $this->belongsToMany(Post::class, 'post_bookmarks')
                    ->withTimestamps();
    }

    public function shares()
    {
        return $this->belongsToMany(Post::class, 'post_shares')
                    ->withTimestamps();
    }

    public function views()
    {
        return $this->belongsToMany(Post::class, 'post_views')
                    ->withTimestamps();
    }

    public function reclips()
    {
        return $this->belongsToMany(Post::class, 'post_reclips')
                    ->withTimestamps();
    }

    // Helper methods
    public function isFollowing(User $user)
    {
        return $this->following()->where('following_id', $user->id)->exists();
    }

    public function hasPendingFollowRequest(User $user)
    {
        return DB::table('user_follows')
            ->where('follower_id', $this->id)
            ->where('following_id', $user->id)
            ->where('status', 'pending')
            ->exists();
    }

    public function canViewProfile(User $viewer)
    {
        // Users can always view their own profile
        if ($this->id === $viewer->id) {
            return true;
        }

        // If profile is not private, anyone can view
        if (!$this->is_private) {
            return true;
        }

        // If profile is private, only followers can view
        return $this->followers()->where('follower_id', $viewer->id)->exists();
    }

    public function canSendMessage(User $sender)
    {
        // Users can always message themselves (though this shouldn't happen)
        if ($this->id === $sender->id) {
            return true;
        }

        // If profile is not private, anyone can message
        if (!$this->is_private) {
            return true;
        }

        // If profile is private, only followers can message
        return $this->followers()->where('follower_id', $sender->id)->exists();
    }

    public function hasLikedPost(Post $post)
    {
        return $this->postLikes()->where('post_id', $post->id)->exists();
    }

    public function hasLikedComment(Comment $comment)
    {
        return $this->commentLikes()->where('comment_id', $comment->id)->exists();
    }

    public function hasBookmarked(Post $post)
    {
        return $this->bookmarks()->where('post_id', $post->id)->exists();
    }

    public function hasViewed(Post $post)
    {
        return $this->views()->where('post_id', $post->id)->exists();
    }

    public function hasReclipped(Post $post)
    {
        return $this->reclips()->where('post_id', $post->id)->exists();
    }

    // Notifications relationships
    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    public function unreadNotifications()
    {
        return $this->hasMany(Notification::class)->where('read', false);
    }

    // Messages relationships
    public function sentMessages()
    {
        return $this->hasMany(Message::class, 'sender_handle', 'handle');
    }

    public function receivedMessages()
    {
        return $this->hasMany(Message::class, 'recipient_handle', 'handle');
    }

    public function conversations()
    {
        // Get all unique conversation IDs involving this user
        $conversationIds = Message::where('sender_handle', $this->handle)
            ->orWhere('recipient_handle', $this->handle)
            ->distinct()
            ->pluck('conversation_id');

        return Message::whereIn('conversation_id', $conversationIds)
            ->orderBy('created_at', 'desc');
    }

    // Stories relationships
    public function stories()
    {
        return $this->hasMany(Story::class);
    }

    public function activeStories()
    {
        return $this->hasMany(Story::class)->where('expires_at', '>', now());
    }

    public function storyViews()
    {
        return $this->hasMany(StoryView::class);
    }

    public function storyReactions()
    {
        return $this->hasMany(StoryReaction::class);
    }

    public function storyReplies()
    {
        return $this->hasMany(StoryReply::class);
    }

    // Collections relationships
    public function collections()
    {
        return $this->hasMany(Collection::class);
    }

    public function publicCollections()
    {
        return $this->hasMany(Collection::class)->where('is_private', false);
    }

    public function privateCollections()
    {
        return $this->hasMany(Collection::class)->where('is_private', true);
    }

    // Tagged in posts relationship (many-to-many)
    public function taggedInPosts()
    {
        return $this->belongsToMany(Post::class, 'post_tagged_users')
                    ->withPivot('user_handle')
                    ->withTimestamps();
    }
}

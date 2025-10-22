<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
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
        'location_local',
        'location_regional',
        'location_national',
        'is_verified',
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
        'followers_count' => 'integer',
        'following_count' => 'integer',
        'posts_count' => 'integer',
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
                    ->withTimestamps();
    }

    public function following()
    {
        return $this->belongsToMany(User::class, 'user_follows', 'follower_id', 'following_id')
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
        return $this->hasMany(PostShare::class);
    }

    public function views()
    {
        return $this->hasMany(PostView::class);
    }

    public function reclips()
    {
        return $this->hasMany(PostReclip::class);
    }

    // Helper methods
    public function isFollowing(User $user)
    {
        return $this->following()->where('following_id', $user->id)->exists();
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
}

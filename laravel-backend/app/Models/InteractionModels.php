<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PostLike extends Model
{
    use HasFactory;

    protected $table = 'post_likes';
    
    protected $fillable = [
        'user_id',
        'post_id',
    ];

    public $timestamps = true;

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function post()
    {
        return $this->belongsTo(Post::class);
    }
}

class CommentLike extends Model
{
    use HasFactory;

    protected $table = 'comment_likes';
    
    protected $fillable = [
        'user_id',
        'comment_id',
    ];

    public $timestamps = true;

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function comment()
    {
        return $this->belongsTo(Comment::class);
    }
}

class PostBookmark extends Model
{
    use HasFactory;

    protected $table = 'post_bookmarks';
    
    protected $fillable = [
        'user_id',
        'post_id',
    ];

    public $timestamps = true;

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function post()
    {
        return $this->belongsTo(Post::class);
    }
}

class UserFollow extends Model
{
    use HasFactory;

    protected $table = 'user_follows';
    
    protected $fillable = [
        'follower_id',
        'following_id',
    ];

    public $timestamps = true;

    // Relationships
    public function follower()
    {
        return $this->belongsTo(User::class, 'follower_id');
    }

    public function following()
    {
        return $this->belongsTo(User::class, 'following_id');
    }
}

class PostShare extends Model
{
    use HasFactory;

    protected $table = 'post_shares';
    
    protected $fillable = [
        'user_id',
        'post_id',
    ];

    public $timestamps = true;

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function post()
    {
        return $this->belongsTo(Post::class);
    }
}

class PostView extends Model
{
    use HasFactory;

    protected $table = 'post_views';
    
    protected $fillable = [
        'user_id',
        'post_id',
    ];

    public $timestamps = true;

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function post()
    {
        return $this->belongsTo(Post::class);
    }
}

class PostReclip extends Model
{
    use HasFactory;

    protected $table = 'post_reclips';
    
    protected $fillable = [
        'user_id',
        'post_id',
        'user_handle',
    ];

    public $timestamps = true;

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function post()
    {
        return $this->belongsTo(Post::class);
    }
}

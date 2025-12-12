<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RenderJob extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'user_id',
        'post_id',
        'status',
        'edit_timeline',
        'ai_music_config',
        'video_source_url',
        'music_url',
        'final_video_url',
        'error_message',
    ];

    protected $casts = [
        'edit_timeline' => 'array',
        'ai_music_config' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

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




















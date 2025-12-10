<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Music extends Model
{
    use HasFactory;

    protected $table = 'music';

    protected $fillable = [
        'title',
        'artist',
        'genre',
        'mood',
        'duration',
        'url',
        'file_path',
        'thumbnail_url',
        'usage_count',
        'is_ai_generated',
        'ai_service',
        'metadata',
        'is_active',
        'license_type',
        'license_url',
        'license_requires_attribution',
    ];

    protected $casts = [
        'duration' => 'integer',
        'usage_count' => 'integer',
        'is_ai_generated' => 'boolean',
        'is_active' => 'boolean',
        'license_requires_attribution' => 'boolean',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeByGenre($query, $genre)
    {
        return $query->where('genre', $genre);
    }

    public function scopeByMood($query, $mood)
    {
        return $query->where('mood', $mood);
    }

    public function scopeAiGenerated($query)
    {
        return $query->where('is_ai_generated', true);
    }

    public function scopeLibrary($query)
    {
        return $query->where('is_ai_generated', false);
    }

    public function scopeLicenseSafe($query)
    {
        // Only return tracks with licenses that allow derivatives (no CC-ND)
        return $query->where(function ($q) {
            $q->whereIn('license_type', ['CC0', 'CC-BY', 'CC-BY-SA', 'Public Domain'])
              ->orWhereNull('license_type'); // Include tracks without license info (legacy)
        });
    }

    // Increment usage count when music is used
    public function incrementUsage()
    {
        $this->increment('usage_count');
    }

    // Get attribution text for this track
    public function getAttributionText(): ?string
    {
        if (!$this->license_requires_attribution) {
            return null;
        }

        return "Music: {$this->artist} - {$this->title} ({$this->license_type})";
    }

    // Relationship: posts that use this music track
    public function posts()
    {
        return $this->hasMany(Post::class, 'music_track_id');
    }
}




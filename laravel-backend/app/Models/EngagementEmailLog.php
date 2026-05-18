<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class EngagementEmailLog extends Model
{
    public $timestamps = false;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'user_id',
        'type',
        'payload',
        'sent_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'sent_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (EngagementEmailLog $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            if (empty($model->sent_at)) {
                $model->sent_at = now();
            }
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

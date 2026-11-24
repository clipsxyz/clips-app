<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class TargetBusiness extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected static function booted(): void
    {
        static::creating(function (TargetBusiness $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    protected $fillable = [
        'google_place_id',
        'name',
        'category',
        'formatted_address',
        'latitude',
        'longitude',
        'website',
        'phone',
        'outreach_status',
        'cached_at',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'cached_at' => 'datetime',
    ];
};

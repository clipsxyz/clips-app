<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ProfilePostSubscription extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'subscriber_id',
        'creator_id',
    ];

    protected static function booted(): void
    {
        static::creating(function (ProfilePostSubscription $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }
}

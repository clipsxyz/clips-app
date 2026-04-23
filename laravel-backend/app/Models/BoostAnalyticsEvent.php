<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BoostAnalyticsEvent extends Model
{
    protected $fillable = [
        'boost_id',
        'post_id',
        'actor_user_id',
        'event_type',
        'attribution_context',
    ];

    public function boost(): BelongsTo
    {
        return $this->belongsTo(Boost::class);
    }
}


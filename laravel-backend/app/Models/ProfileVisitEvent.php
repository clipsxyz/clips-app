<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProfileVisitEvent extends Model
{
    protected $fillable = [
        'profile_user_id',
        'actor_user_id',
        'source_post_id',
        'boost_id',
        'attribution_context',
    ];
}

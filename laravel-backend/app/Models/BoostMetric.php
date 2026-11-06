<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BoostMetric extends Model
{
    use HasFactory;

    protected $fillable = [
        'boost_id',
        'impressions',
        'reach',
        'clicks',
        'ctr',
        'date',
    ];

    protected $casts = [
        'date' => 'date',
        'impressions' => 'integer',
        'reach' => 'integer',
        'clicks' => 'integer',
        'ctr' => 'float',
    ];

    public function boost(): BelongsTo
    {
        return $this->belongsTo(Boost::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Boost extends Model
{
    use HasFactory;

    protected $fillable = [
        'post_id',
        'user_id',
        'feed_type',
        'status',
        'price',
        'radius_km',
        'center_local',
        'eligible_users_count',
        'duration_hours',
        'impressions_count',
        'likes_count',
        'comments_count',
        'shares_count',
        'last_analytics_event_at',
        'payment_intent_id',
        'activated_at',
        'expires_at',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'activated_at' => 'datetime',
        'expires_at' => 'datetime',
        'last_analytics_event_at' => 'datetime',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function metrics(): HasMany
    {
        return $this->hasMany(BoostMetric::class);
    }

    /**
     * CTR is clicks divided by impressions, stored as a percentage.
     */
    public function recalculateCtrForDate($date): void
    {
        $day = Carbon::parse($date)->toDateString();
        $metric = $this->metrics()->whereDate('date', $day)->first();
        if (! $metric) {
            return;
        }

        $impressions = (int) $metric->impressions;
        if ($impressions <= 0) {
            return;
        }

        $metric->ctr = round(((int) $metric->clicks / $impressions) * 100, 2);
        $metric->save();
    }

    /**
     * Euros actually charged for this boost.
     * A payment row wins, then a stored price. Never a catalog placeholder.
     */
    public function chargedSpendEur(): float
    {
        foreach (['amount_paid', 'budget'] as $attribute) {
            $value = $this->getAttribute($attribute);
            if (is_numeric($value) && (float) $value > 0) {
                return round((float) $value, 2);
            }
        }

        $cents = BoostTransaction::query()
            ->where('post_id', $this->post_id)
            ->where('user_id', $this->user_id)
            ->orderByDesc('id')
            ->value('amount_cents');
        if (is_numeric($cents) && (int) $cents > 0) {
            return round(((int) $cents) / 100, 2);
        }

        $price = (float) ($this->price ?? 0);

        return $price > 0 ? round($price, 2) : 0.0;
    }

    public function scopeActive($query)
    {
        return $query->where('expires_at', '>', now());
    }

    public function scopeForFeedType($query, string $feedType)
    {
        return $query->where('feed_type', $feedType);
    }
}

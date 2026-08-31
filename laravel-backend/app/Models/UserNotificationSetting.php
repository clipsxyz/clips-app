<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class UserNotificationSetting extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * Client (camelCase) key => column name.
     *
     * @var array<string, string>
     */
    public const CLIENT_TO_COLUMN = [
        'enabled' => 'enabled',
        'directMessages' => 'direct_messages',
        'groupChats' => 'group_chats',
        'likes' => 'likes',
        'comments' => 'comments',
        'replies' => 'replies',
        'follows' => 'follows',
        'followRequests' => 'follow_requests',
        'storyInsights' => 'story_insights',
        'questions' => 'questions',
        'shares' => 'shares',
        'reclips' => 'reclips',
    ];

    protected $fillable = [
        'user_id',
        'enabled',
        'direct_messages',
        'group_chats',
        'likes',
        'comments',
        'replies',
        'follows',
        'follow_requests',
        'story_insights',
        'questions',
        'shares',
        'reclips',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'direct_messages' => 'boolean',
        'group_chats' => 'boolean',
        'likes' => 'boolean',
        'comments' => 'boolean',
        'replies' => 'boolean',
        'follows' => 'boolean',
        'follow_requests' => 'boolean',
        'story_insights' => 'boolean',
        'questions' => 'boolean',
        'shares' => 'boolean',
        'reclips' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::creating(function (UserNotificationSetting $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    /**
     * @return array<string, bool>
     */
    public static function defaultClientPreferences(): array
    {
        $defaults = [];
        foreach (array_keys(self::CLIENT_TO_COLUMN) as $key) {
            $defaults[$key] = true;
        }

        return $defaults;
    }

    /**
     * @param  array<string, mixed>  $prefs
     * @return array<string, bool>
     */
    public static function sanitizeClientPreferences(array $prefs): array
    {
        $clean = [];
        foreach (self::CLIENT_TO_COLUMN as $clientKey => $_column) {
            if (! array_key_exists($clientKey, $prefs)) {
                continue;
            }
            $clean[$clientKey] = filter_var($prefs[$clientKey], FILTER_VALIDATE_BOOLEAN);
        }

        return $clean;
    }

    /**
     * @return array<string, bool>
     */
    public function toClientPreferences(): array
    {
        $out = [];
        foreach (self::CLIENT_TO_COLUMN as $clientKey => $column) {
            $out[$clientKey] = (bool) $this->{$column};
        }

        return $out;
    }

    /**
     * @param  array<string, bool>  $prefs
     */
    public function fillFromClient(array $prefs): self
    {
        foreach (self::CLIENT_TO_COLUMN as $clientKey => $column) {
            if (array_key_exists($clientKey, $prefs)) {
                $this->{$column} = (bool) $prefs[$clientKey];
            }
        }

        return $this;
    }

    public function allows(string $prefKey): bool
    {
        if (! $this->enabled) {
            return false;
        }

        $column = self::CLIENT_TO_COLUMN[$prefKey] ?? null;
        if ($column === null || $column === 'enabled') {
            return true;
        }

        return (bool) $this->{$column};
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

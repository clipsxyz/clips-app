<?php

use App\Models\ChatGroup;
use Illuminate\Support\Facades\Broadcast;

/*
| Private chat channels.
| 1:1 DMs: chat.user.{userId} — only that user may listen.
| Groups: chat.group.{groupId} — only active members may listen.
*/

Broadcast::channel('chat.user.{userId}', function ($user, string $userId) {
    return $user && (string) $user->id === (string) $userId;
}, ['guards' => ['sanctum', 'api', 'web']]);

Broadcast::channel('chat.group.{groupId}', function ($user, string $groupId) {
    if (! $user) {
        return false;
    }
    $group = ChatGroup::query()->whereNull('deleted_at')->find($groupId);

    return $group && $group->hasActiveMember($user);
}, ['guards' => ['sanctum', 'api', 'web']]);

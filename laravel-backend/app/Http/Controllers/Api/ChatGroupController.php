<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatGroup;
use App\Models\ChatGroupInvite;
use App\Models\ChatGroupMember;
use App\Models\Message;
use App\Models\Notification;
use App\Models\User;
use App\Services\InteractionPushService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class ChatGroupController extends Controller
{
    /** Groups the current user belongs to (active membership). */
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();

        $memberships = ChatGroupMember::query()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->whereHas('chatGroup', fn ($q) => $q->whereNull('deleted_at'))
            ->with(['chatGroup.creator'])
            ->orderByDesc('updated_at')
            ->get();

        $items = $memberships->map(function (ChatGroupMember $m) use ($user) {
            $g = $m->chatGroup;

            return [
                'id' => $g->id,
                'name' => $g->name,
                'avatar_url' => $g->avatar_url,
                'conversation_id' => $g->conversation_id,
                'creator_id' => $g->creator_id,
                'is_admin' => $g->isAdmin($user),
                'role' => $m->role,
                'member_count' => $g->activeMembers()->count(),
                'created_at' => $g->created_at,
            ];
        });

        return response()->json(['items' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:1|max:120',
            'avatar_url' => 'nullable|string|max:65535',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();

        $group = DB::transaction(function () use ($request, $user) {
            $group = ChatGroup::create([
                'name' => trim($request->name),
                'avatar_url' => $request->input('avatar_url'),
                'creator_id' => $user->id,
            ]);

            ChatGroupMember::create([
                'chat_group_id' => $group->id,
                'user_id' => $user->id,
                'role' => 'admin',
            ]);

            return $group->fresh(['creator']);
        });

        return response()->json($group, 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = Auth::user();
        $group = ChatGroup::whereNull('deleted_at')->find($id);

        if (! $group) {
            return response()->json(['error' => 'Group not found'], 404);
        }

        if ($group->creator_id !== $user->id) {
            return response()->json(['error' => 'Only the creator can delete this group'], 403);
        }

        DB::transaction(function () use ($group) {
            ChatGroupMember::where('chat_group_id', $group->id)
                ->whereNull('left_at')
                ->update(['left_at' => now()]);

            ChatGroupInvite::where('chat_group_id', $group->id)
                ->where('status', 'pending')
                ->update(['status' => 'cancelled']);

            $group->delete();
        });

        return response()->json(['success' => true]);
    }

    public function leave(Request $request, string $id): JsonResponse
    {
        $user = Auth::user();
        $group = ChatGroup::whereNull('deleted_at')->find($id);

        if (! $group) {
            return response()->json(['error' => 'Group not found'], 404);
        }

        if ($group->creator_id === $user->id) {
            return response()->json([
                'error' => 'Creator cannot leave',
                'message' => 'Delete the group instead, or transfer ownership in a future release.',
            ], 403);
        }

        $updated = ChatGroupMember::where('chat_group_id', $group->id)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->update(['left_at' => now()]);

        if (! $updated) {
            return response()->json(['error' => 'Not an active member'], 403);
        }

        return response()->json(['success' => true]);
    }

    public function invite(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'invitee_handle' => 'required|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $group = ChatGroup::whereNull('deleted_at')->find($id);

        if (! $group) {
            return response()->json(['error' => 'Group not found'], 404);
        }

        if (! $group->hasActiveMember($user)) {
            return response()->json(['error' => 'You are not a member of this group'], 403);
        }

        if (! $group->isAdmin($user)) {
            return response()->json(['error' => 'Only group admins can send invites.'], 403);
        }

        // Invites are notification-based (accept/decline). Do not reuse DM
        // privacy (`canSendMessage`) — a private profile must still be invitable.
        $invitee = User::findByHandle($request->invitee_handle);
        if (! $invitee) {
            return response()->json(['error' => 'User not found'], 404);
        }

        if ($invitee->id === $user->id) {
            return response()->json(['error' => 'Cannot invite yourself'], 400);
        }

        if ($group->activeMembers()->where('user_id', $invitee->id)->exists()) {
            return response()->json(['error' => 'User is already in this group'], 400);
        }

        $invite = DB::transaction(function () use ($group, $user, $invitee) {
            ChatGroupInvite::where('chat_group_id', $group->id)
                ->where('invitee_id', $invitee->id)
                ->where('status', 'pending')
                ->update(['status' => 'cancelled']);

            $invite = ChatGroupInvite::create([
                'chat_group_id' => $group->id,
                'inviter_id' => $user->id,
                'invitee_id' => $invitee->id,
                'status' => 'pending',
                'expires_at' => Carbon::now()->addDays(14),
            ]);

            Notification::create([
                'user_id' => $invitee->id,
                'type' => 'group_invite',
                'from_handle' => $user->handle,
                'to_handle' => $invitee->handle,
                'message' => $user->handle . ' invited you to join ' . $group->name,
                'chat_group_invite_id' => $invite->id,
                'read' => false,
            ]);

            return $invite->load(['chatGroup', 'inviter', 'invitee']);
        });

        try {
            app(InteractionPushService::class)->notifyGroupInvite(
                $user,
                $invitee,
                $group,
                (string) $invite->id
            );
        } catch (\Throwable $e) {
            Log::warning('Failed to dispatch group invite push', [
                'invite_id' => $invite->id ?? null,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            ...$invite->toArray(),
            'inviteeHandle' => $invitee->handle,
        ], 201);
    }

    public function pendingInvites(Request $request): JsonResponse
    {
        $user = Auth::user();

        $invites = ChatGroupInvite::query()
            ->where('invitee_id', $user->id)
            ->where('status', 'pending')
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->with(['chatGroup.creator', 'inviter'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['items' => $invites]);
    }

    public function acceptInvite(Request $request, string $inviteId): JsonResponse
    {
        $user = Auth::user();
        $invite = ChatGroupInvite::with('chatGroup')->find($inviteId);

        if (! $invite) {
            return response()->json(['error' => 'Invite not found'], 404);
        }

        if ($invite->invitee_id !== $user->id) {
            return response()->json(['error' => 'Not your invite'], 403);
        }

        $group = $invite->chatGroup;
        if (! $group || $group->trashed()) {
            return response()->json(['error' => 'This group no longer exists'], 410);
        }

        if ($group->hasActiveMember($user)) {
            if ($invite->status === 'pending') {
                $invite->update(['status' => 'accepted']);
            }

            return response()->json(['success' => true, 'group' => $group->fresh(), 'already' => true]);
        }

        if ($invite->status !== 'pending') {
            $replacement = ChatGroupInvite::with('chatGroup')
                ->where('chat_group_id', $group->id)
                ->where('invitee_id', $user->id)
                ->where('status', 'pending')
                ->where(function ($q) {
                    $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
                })
                ->orderByDesc('created_at')
                ->first();
            if (! $replacement || ! $replacement->chatGroup || $replacement->chatGroup->trashed()) {
                return response()->json(['error' => 'This invite is no longer pending.'], 409);
            }
            $invite = $replacement;
            $group = $replacement->chatGroup;
        }

        if ($invite->expires_at && $invite->expires_at->isPast()) {
            $invite->update(['status' => 'expired']);

            return response()->json(['error' => 'Invite expired'], 400);
        }

        try {
            DB::transaction(function () use ($invite, $group, $user) {
                $locked = ChatGroupInvite::query()->where('id', $invite->id)->lockForUpdate()->first();
                if (! $locked || $locked->status === 'accepted') {
                    return;
                }
                if ($locked->status !== 'pending') {
                    return;
                }

                $member = ChatGroupMember::query()
                    ->where('chat_group_id', $group->id)
                    ->where('user_id', $user->id)
                    ->lockForUpdate()
                    ->first();

                if ($member && $member->left_at) {
                    $member->update([
                        'left_at' => null,
                        'role' => 'member',
                        'last_read_at' => now(),
                    ]);
                } elseif (! $member) {
                    ChatGroupMember::firstOrCreate(
                        [
                            'chat_group_id' => $group->id,
                            'user_id' => $user->id,
                        ],
                        [
                            'role' => 'member',
                            'last_read_at' => now(),
                        ]
                    );
                }

                $locked->update(['status' => 'accepted']);

                Notification::where('chat_group_invite_id', $invite->id)
                    ->update(['read' => true]);
            });
        } catch (\Throwable $e) {
            $current = ChatGroupInvite::with('chatGroup')->find($inviteId);
            if ($current && ($current->status === 'accepted' || ChatGroupMember::query()
                ->where('chat_group_id', $group->id)
                ->where('user_id', $user->id)
                ->exists())) {
                return response()->json(['success' => true, 'group' => $current->chatGroup, 'already' => true]);
            }

            return response()->json(['error' => 'Could not accept this invite.'], 409);
        }

        return response()->json(['success' => true, 'group' => $group->fresh()]);
    }

    public function declineInvite(Request $request, string $inviteId): JsonResponse
    {
        $user = Auth::user();
        $invite = ChatGroupInvite::find($inviteId);

        if (! $invite || $invite->invitee_id !== $user->id) {
            return response()->json(['error' => 'Invite not found'], 404);
        }

        if ($invite->status !== 'pending') {
            return response()->json(['success' => true, 'already' => true]);
        }

        $invite->update(['status' => 'declined']);

        Notification::where('chat_group_invite_id', $invite->id)
            ->update(['read' => true]);

        return response()->json(['success' => true]);
    }

    /** Active members for anyone already in the group. */
    public function members(Request $request, string $id): JsonResponse
    {
        $user = Auth::user();
        $group = $this->activeGroup($id);

        if (! $group) {
            return response()->json(['error' => 'Group not found'], 404);
        }

        if (! $group->hasActiveMember($user)) {
            return response()->json(['error' => 'You are not a member of this group'], 403);
        }

        $items = $group->activeMembers()
            ->with('user')
            ->orderBy('created_at')
            ->get()
            ->map(function (ChatGroupMember $member) use ($group) {
                $person = $member->user;

                return [
                    'user_id' => $member->user_id,
                    'handle' => $person?->handle,
                    'display_name' => $person?->display_name,
                    'avatar_url' => $person?->avatar_url,
                    'role' => $group->creator_id === $member->user_id ? 'admin' : $member->role,
                    'is_creator' => $group->creator_id === $member->user_id,
                ];
            })
            ->values();

        return response()->json([
            'name' => $group->name,
            'creator_id' => $group->creator_id,
            'is_admin' => $group->isAdmin($user),
            'items' => $items,
        ]);
    }

    /** Rename. Admins only, same as WhatsApp group subject. */
    public function update(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:1|max:120',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $group = $this->activeGroup($id);

        if (! $group) {
            return response()->json(['error' => 'Group not found'], 404);
        }

        if (! $group->isAdmin($user)) {
            return response()->json(['error' => 'Only group admins can edit this group.'], 403);
        }

        $name = trim((string) $request->input('name'));
        if ($name === '') {
            return response()->json(['error' => 'Group name is required'], 400);
        }

        if ($name !== $group->name) {
            $group->name = $name;
            $group->save();
            $this->postGroupNotice($group, $user, $user->handle.' changed the group name to "'.$name.'"');
        }

        return response()->json([
            'id' => $group->id,
            'name' => $group->name,
        ]);
    }

    public function removeMember(Request $request, string $id, string $userId): JsonResponse
    {
        $user = Auth::user();
        $group = $this->activeGroup($id);

        if (! $group) {
            return response()->json(['error' => 'Group not found'], 404);
        }

        if (! $group->isAdmin($user)) {
            return response()->json(['error' => 'Only group admins can remove people.'], 403);
        }

        if ($userId === $user->id) {
            return response()->json(['error' => 'Leave the group instead of removing yourself.'], 400);
        }

        if ($userId === $group->creator_id) {
            return response()->json(['error' => 'The person who created the group cannot be removed.'], 403);
        }

        $membership = ChatGroupMember::query()
            ->where('chat_group_id', $group->id)
            ->where('user_id', $userId)
            ->whereNull('left_at')
            ->first();

        if (! $membership) {
            return response()->json(['error' => 'That person is not in this group'], 404);
        }

        $membership->update(['left_at' => now()]);

        ChatGroupInvite::where('chat_group_id', $group->id)
            ->where('invitee_id', $userId)
            ->where('status', 'pending')
            ->update(['status' => 'cancelled']);

        $removed = User::find($userId);
        $label = $removed?->handle ?: 'a member';
        $this->postGroupNotice($group, $user, $user->handle.' removed '.$label);

        return response()->json(['success' => true]);
    }

    public function updateMemberRole(Request $request, string $id, string $userId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'role' => 'required|string|in:admin,member',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();
        $group = $this->activeGroup($id);

        if (! $group) {
            return response()->json(['error' => 'Group not found'], 404);
        }

        if (! $group->isAdmin($user)) {
            return response()->json(['error' => 'Only group admins can change roles.'], 403);
        }

        if ($userId === $group->creator_id) {
            return response()->json(['error' => 'The person who created the group stays an admin.'], 403);
        }

        if ($userId === $user->id) {
            return response()->json(['error' => 'You cannot change your own admin role.'], 400);
        }

        $membership = ChatGroupMember::query()
            ->where('chat_group_id', $group->id)
            ->where('user_id', $userId)
            ->whereNull('left_at')
            ->first();

        if (! $membership) {
            return response()->json(['error' => 'That person is not in this group'], 404);
        }

        $role = (string) $request->input('role');
        if ($membership->role !== $role) {
            $membership->update(['role' => $role]);
            $target = User::find($userId);
            $label = $target?->handle ?: 'a member';
            $verb = $role === 'admin' ? 'made '.$label.' a group admin' : 'dismissed '.$label.' as admin';
            $this->postGroupNotice($group, $user, $user->handle.' '.$verb);
        }

        return response()->json(['success' => true, 'role' => $role]);
    }

    private function activeGroup(string $id): ?ChatGroup
    {
        return ChatGroup::whereNull('deleted_at')->find($id);
    }

    private function postGroupNotice(ChatGroup $group, User $actor, string $text): void
    {
        Message::create([
            'conversation_id' => $group->conversation_id,
            'chat_group_id' => $group->id,
            'sender_handle' => $actor->handle,
            'recipient_handle' => $actor->handle,
            'text' => $text,
            'is_system_message' => true,
        ]);
    }
}

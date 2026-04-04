<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatGroup;
use App\Models\ChatGroupInvite;
use App\Models\ChatGroupMember;
use App\Models\Notification;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
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

        $items = $memberships->map(function (ChatGroupMember $m) {
            $g = $m->chatGroup;

            return [
                'id' => $g->id,
                'name' => $g->name,
                'conversation_id' => $g->conversation_id,
                'creator_id' => $g->creator_id,
                'is_admin' => $g->creator_id === Auth::id(),
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
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = Auth::user();

        $group = DB::transaction(function () use ($request, $user) {
            $group = ChatGroup::create([
                'name' => trim($request->name),
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
            'invitee_handle' => 'required|string|exists:users,handle',
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

        $invitee = User::where('handle', $request->invitee_handle)->firstOrFail();

        if ($invitee->id === $user->id) {
            return response()->json(['error' => 'Cannot invite yourself'], 400);
        }

        if ($group->activeMembers()->where('user_id', $invitee->id)->exists()) {
            return response()->json(['error' => 'User is already in this group'], 400);
        }

        if (! $invitee->canSendMessage($user)) {
            return response()->json([
                'error' => 'Cannot invite this user',
                'message' => 'Messaging is restricted for this account.',
            ], 403);
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

        return response()->json($invite, 201);
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

        if ($invite->status !== 'pending') {
            return response()->json(['error' => 'Invite is no longer pending'], 400);
        }

        if ($invite->expires_at && $invite->expires_at->isPast()) {
            $invite->update(['status' => 'expired']);

            return response()->json(['error' => 'Invite expired'], 400);
        }

        $group = $invite->chatGroup;
        if ($group->trashed()) {
            return response()->json(['error' => 'This group no longer exists'], 410);
        }

        DB::transaction(function () use ($invite, $group, $user) {
            $member = ChatGroupMember::where('chat_group_id', $group->id)
                ->where('user_id', $user->id)
                ->first();

            if ($member && $member->left_at) {
                $member->update([
                    'left_at' => null,
                    'role' => 'member',
                    'last_read_at' => now(),
                ]);
            } elseif (! $member) {
                ChatGroupMember::create([
                    'chat_group_id' => $group->id,
                    'user_id' => $user->id,
                    'role' => 'member',
                    'last_read_at' => now(),
                ]);
            }

            $invite->update(['status' => 'accepted']);

            Notification::where('chat_group_invite_id', $invite->id)
                ->update(['read' => true]);
        });

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
            return response()->json(['error' => 'Invite is no longer pending'], 400);
        }

        $invite->update(['status' => 'declined']);

        Notification::where('chat_group_invite_id', $invite->id)
            ->update(['read' => true]);

        return response()->json(['success' => true]);
    }
}

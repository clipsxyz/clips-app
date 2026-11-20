<?php

namespace Tests\Feature;

use App\Models\ChatGroup;
use App\Models\ChatGroupInvite;
use App\Models\ChatGroupMember;
use App\Models\Message;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatGroupControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_member_can_list_groups_they_admin(): void
    {
        $admin = User::factory()->create(['handle' => 'gazetteer@dublin']);
        $group = $this->makeGroupWithMember($admin, 'Cork crew');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/chat-groups')
            ->assertOk()
            ->assertJsonPath('items.0.id', $group->id)
            ->assertJsonPath('items.0.name', 'Cork crew')
            ->assertJsonPath('items.0.is_admin', true)
            ->assertJsonPath('items.0.role', 'admin');
    }

    public function test_invite_to_private_user_creates_notification(): void
    {
        $inviter = User::factory()->create(['handle' => 'gazetteer@dublin', 'is_private' => false]);
        $invitee = User::factory()->create(['handle' => 'barry@cork', 'is_private' => true]);
        $group = $this->makeGroupWithMember($inviter, 'Cork crew');

        $response = $this->actingAs($inviter, 'sanctum')
            ->postJson("/api/chat-groups/{$group->id}/invites", [
                'invitee_handle' => 'Barry@Cork',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('inviteeHandle', 'barry@cork')
            ->assertJsonPath('status', 'pending');

        $this->assertDatabaseHas('chat_group_invites', [
            'chat_group_id' => $group->id,
            'inviter_id' => $inviter->id,
            'invitee_id' => $invitee->id,
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $invitee->id,
            'type' => 'group_invite',
            'from_handle' => $inviter->handle,
            'to_handle' => $invitee->handle,
            'read' => 0,
        ]);

        $this->assertTrue(
            Notification::where('user_id', $invitee->id)->where('type', 'group_invite')->exists()
        );
    }

    public function test_invite_rejects_unknown_handle(): void
    {
        $inviter = User::factory()->create(['handle' => 'gazetteer@dublin']);
        $group = $this->makeGroupWithMember($inviter, 'Cork crew');

        $response = $this->actingAs($inviter, 'sanctum')
            ->postJson("/api/chat-groups/{$group->id}/invites", [
                'invitee_handle' => 'nobody@here',
            ]);

        $response->assertStatus(404)
            ->assertJson(['error' => 'User not found']);
    }

    public function test_invite_rejects_self(): void
    {
        $inviter = User::factory()->create(['handle' => 'gazetteer@dublin']);
        $group = $this->makeGroupWithMember($inviter, 'Cork crew');

        $response = $this->actingAs($inviter, 'sanctum')
            ->postJson("/api/chat-groups/{$group->id}/invites", [
                'invitee_handle' => 'gazetteer@dublin',
            ]);

        $response->assertStatus(400)
            ->assertJson(['error' => 'Cannot invite yourself']);
    }

    public function test_invite_rejects_regular_member(): void
    {
        $creator = User::factory()->create(['handle' => 'gazetteer@dublin']);
        $member = User::factory()->create(['handle' => 'ava@galway']);
        $invitee = User::factory()->create(['handle' => 'barry@cork']);
        $group = $this->makeGroupWithMember($creator, 'Cork crew');
        ChatGroupMember::create([
            'chat_group_id' => $group->id,
            'user_id' => $member->id,
            'role' => 'member',
        ]);

        $response = $this->actingAs($member, 'sanctum')
            ->postJson("/api/chat-groups/{$group->id}/invites", [
                'invitee_handle' => 'barry@cork',
            ]);

        $response->assertStatus(403)
            ->assertJson(['error' => 'Only group admins can send invites.']);

        $this->assertDatabaseMissing('chat_group_invites', [
            'chat_group_id' => $group->id,
            'inviter_id' => $member->id,
            'invitee_id' => $invitee->id,
        ]);
    }

    public function test_invite_rejects_existing_member(): void
    {
        $inviter = User::factory()->create(['handle' => 'gazetteer@dublin']);
        $member = User::factory()->create(['handle' => 'barry@cork']);
        $group = $this->makeGroupWithMember($inviter, 'Cork crew');
        ChatGroupMember::create([
            'chat_group_id' => $group->id,
            'user_id' => $member->id,
            'role' => 'member',
        ]);

        $response = $this->actingAs($inviter, 'sanctum')
            ->postJson("/api/chat-groups/{$group->id}/invites", [
                'invitee_handle' => 'barry@cork',
            ]);

        $response->assertStatus(400)
            ->assertJson(['error' => 'User is already in this group']);
    }

    public function test_accept_invite_is_idempotent(): void
    {
        $inviter = User::factory()->create(['handle' => 'gazetteer@dublin']);
        $invitee = User::factory()->create(['handle' => 'barry@cork']);
        $group = $this->makeGroupWithMember($inviter, 'Cork crew');
        $invite = ChatGroupInvite::create([
            'chat_group_id' => $group->id,
            'inviter_id' => $inviter->id,
            'invitee_id' => $invitee->id,
            'status' => 'pending',
        ]);

        $first = $this->actingAs($invitee, 'sanctum')
            ->postJson("/api/chat-groups/invites/{$invite->id}/accept");
        $first->assertOk()->assertJson(['success' => true]);

        $second = $this->actingAs($invitee, 'sanctum')
            ->postJson("/api/chat-groups/invites/{$invite->id}/accept");
        $second->assertOk()->assertJson(['success' => true]);

        $this->assertEquals(1, ChatGroupMember::query()
            ->where('chat_group_id', $group->id)
            ->where('user_id', $invitee->id)
            ->count());
    }

    public function test_accepting_a_replaced_invite_joins_the_current_one(): void
    {
        $inviter = User::factory()->create(['handle' => 'gavin@ca']);
        $invitee = User::factory()->create(['handle' => 'trent@liverpool']);
        $group = $this->makeGroupWithMember($inviter, 'The lads');
        $cancelled = ChatGroupInvite::create([
            'chat_group_id' => $group->id,
            'inviter_id' => $inviter->id,
            'invitee_id' => $invitee->id,
            'status' => 'cancelled',
        ]);
        $current = ChatGroupInvite::create([
            'chat_group_id' => $group->id,
            'inviter_id' => $inviter->id,
            'invitee_id' => $invitee->id,
            'status' => 'pending',
        ]);

        $this->actingAs($invitee, 'sanctum')
            ->postJson("/api/chat-groups/invites/{$cancelled->id}/accept")
            ->assertOk()
            ->assertJsonPath('group.id', $group->id);

        $this->assertDatabaseHas('chat_group_members', [
            'chat_group_id' => $group->id,
            'user_id' => $invitee->id,
        ]);
        $this->assertDatabaseHas('chat_group_invites', [
            'id' => $current->id,
            'status' => 'accepted',
        ]);
    }

    public function test_decline_invite_is_idempotent(): void
    {
        $inviter = User::factory()->create(['handle' => 'gazetteer@dublin']);
        $invitee = User::factory()->create(['handle' => 'barry@cork']);
        $group = $this->makeGroupWithMember($inviter, 'Cork crew');
        $invite = ChatGroupInvite::create([
            'chat_group_id' => $group->id,
            'inviter_id' => $inviter->id,
            'invitee_id' => $invitee->id,
            'status' => 'pending',
        ]);

        $this->actingAs($invitee, 'sanctum')
            ->postJson("/api/chat-groups/invites/{$invite->id}/decline")
            ->assertOk()
            ->assertJson(['success' => true]);

        $this->actingAs($invitee, 'sanctum')
            ->postJson("/api/chat-groups/invites/{$invite->id}/decline")
            ->assertOk()
            ->assertJson(['success' => true]);
    }

    public function test_admin_can_rename_and_list_members(): void
    {
        $admin = User::factory()->create(['handle' => 'gazetteer@dublin']);
        $member = User::factory()->create(['handle' => 'trent@liverpool']);
        $group = $this->makeGroupWithMember($admin, 'Cork crew');
        ChatGroupMember::create([
            'chat_group_id' => $group->id,
            'user_id' => $member->id,
            'role' => 'member',
        ]);

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/chat-groups/{$group->id}", ['name' => 'The lads'])
            ->assertOk()
            ->assertJsonPath('name', 'The lads');

        $this->assertDatabaseHas('messages', [
            'chat_group_id' => $group->id,
            'is_system_message' => 1,
            'text' => 'gazetteer@dublin changed the group name to "The lads"',
        ]);

        $this->actingAs($member, 'sanctum')
            ->getJson("/api/chat-groups/{$group->id}/members")
            ->assertOk()
            ->assertJsonPath('is_admin', false)
            ->assertJsonFragment(['handle' => 'trent@liverpool', 'is_creator' => false])
            ->assertJsonFragment(['handle' => 'gazetteer@dublin', 'is_creator' => true]);
    }

    public function test_member_cannot_rename_or_remove(): void
    {
        $admin = User::factory()->create(['handle' => 'gazetteer@dublin']);
        $member = User::factory()->create(['handle' => 'trent@liverpool']);
        $group = $this->makeGroupWithMember($admin, 'Cork crew');
        ChatGroupMember::create([
            'chat_group_id' => $group->id,
            'user_id' => $member->id,
            'role' => 'member',
        ]);

        $this->actingAs($member, 'sanctum')
            ->patchJson("/api/chat-groups/{$group->id}", ['name' => 'Nope'])
            ->assertStatus(403);

        $this->actingAs($member, 'sanctum')
            ->postJson("/api/chat-groups/{$group->id}/members/{$admin->id}/remove")
            ->assertStatus(403);

        $this->assertSame('Cork crew', $group->fresh()->name);
    }

    public function test_admin_can_promote_and_remove_a_member_but_not_the_creator(): void
    {
        $admin = User::factory()->create(['handle' => 'gazetteer@dublin']);
        $member = User::factory()->create(['handle' => 'trent@liverpool']);
        $group = $this->makeGroupWithMember($admin, 'Cork crew');
        ChatGroupMember::create([
            'chat_group_id' => $group->id,
            'user_id' => $member->id,
            'role' => 'member',
        ]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/chat-groups/{$group->id}/members/{$member->id}/role", ['role' => 'admin'])
            ->assertOk()
            ->assertJsonPath('role', 'admin');

        $this->actingAs($member, 'sanctum')
            ->postJson("/api/chat-groups/{$group->id}/members/{$admin->id}/role", ['role' => 'member'])
            ->assertStatus(403);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/chat-groups/{$group->id}/members/{$admin->id}/remove")
            ->assertStatus(400);

        $this->actingAs($member, 'sanctum')
            ->postJson("/api/chat-groups/{$group->id}/members/{$admin->id}/remove")
            ->assertStatus(403);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/chat-groups/{$group->id}/members/{$member->id}/role", ['role' => 'member'])
            ->assertOk();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/chat-groups/{$group->id}/members/{$member->id}/remove")
            ->assertOk();

        $this->assertNotNull(
            ChatGroupMember::where('chat_group_id', $group->id)->where('user_id', $member->id)->value('left_at')
        );
        $this->assertTrue(
            Message::where('chat_group_id', $group->id)->where('is_system_message', true)->where('text', 'like', '%removed trent@liverpool')->exists()
        );
    }

    private function makeGroupWithMember(User $creator, string $name): ChatGroup
    {
        $group = ChatGroup::create([
            'name' => $name,
            'creator_id' => $creator->id,
        ]);
        ChatGroupMember::create([
            'chat_group_id' => $group->id,
            'user_id' => $creator->id,
            'role' => 'admin',
        ]);

        return $group;
    }
}

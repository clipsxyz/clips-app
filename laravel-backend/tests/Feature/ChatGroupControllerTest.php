<?php

namespace Tests\Feature;

use App\Models\ChatGroup;
use App\Models\ChatGroupMember;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatGroupControllerTest extends TestCase
{
    use RefreshDatabase;

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

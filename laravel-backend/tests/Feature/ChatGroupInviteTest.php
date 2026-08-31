<?php

namespace Tests\Feature;

use App\Models\ChatGroup;
use App\Models\ChatGroupMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatGroupInviteTest extends TestCase
{
    use RefreshDatabase;

    public function test_invite_by_short_handle_creates_notification_with_group_fields(): void
    {
        $donny = User::factory()->create(['handle' => 'Donny@NewYorkState']);
        $gazetteer = User::factory()->create(['handle' => 'Gazetteer@Dublin']);

        $group = ChatGroup::create([
            'name' => 'Test group',
            'creator_id' => $donny->id,
        ]);
        ChatGroupMember::create([
            'chat_group_id' => $group->id,
            'user_id' => $donny->id,
            'role' => 'admin',
        ]);

        $inviteResponse = $this->actingAs($donny, 'sanctum')
            ->postJson('/api/chat-groups/'.$group->id.'/invites', [
                'invitee_handle' => 'Gazetteer',
            ]);

        $inviteResponse->assertStatus(201);

        $pending = $this->actingAs($gazetteer, 'sanctum')
            ->getJson('/api/chat-groups/invites/pending');

        $pending->assertStatus(200)
            ->assertJsonPath('items.0.chat_group.name', 'Test group')
            ->assertJsonPath('items.0.inviter.handle', 'Donny@NewYorkState');

        $notifs = $this->actingAs($gazetteer, 'sanctum')
            ->getJson('/api/notifications?limit=20');

        $notifs->assertStatus(200)
            ->assertJsonPath('items.0.type', 'group_invite')
            ->assertJsonPath('items.0.chat_group_id', $group->id)
            ->assertJsonPath('items.0.group_name', 'Test group');
    }

    public function test_only_creator_admin_can_invite(): void
    {
        $donny = User::factory()->create(['handle' => 'Donny@NewYorkState']);
        $gazetteer = User::factory()->create(['handle' => 'Gazetteer@Dublin']);
        $paris = User::factory()->create(['handle' => 'Paris@CountyCork']);

        $group = ChatGroup::create([
            'name' => 'Test group',
            'creator_id' => $donny->id,
        ]);
        ChatGroupMember::create([
            'chat_group_id' => $group->id,
            'user_id' => $donny->id,
            'role' => 'admin',
        ]);
        ChatGroupMember::create([
            'chat_group_id' => $group->id,
            'user_id' => $gazetteer->id,
            'role' => 'member',
        ]);

        $this->actingAs($gazetteer, 'sanctum')
            ->postJson('/api/chat-groups/'.$group->id.'/invites', [
                'invitee_handle' => 'Paris@CountyCork',
            ])
            ->assertStatus(403)
            ->assertJsonPath('error', 'Only the admin can invite');

        $this->actingAs($donny, 'sanctum')
            ->postJson('/api/chat-groups/'.$group->id.'/invites', [
                'invitee_handle' => 'Paris@CountyCork',
            ])
            ->assertStatus(201);
    }
}

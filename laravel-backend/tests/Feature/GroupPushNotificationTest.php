<?php

namespace Tests\Feature;

use App\Models\ChatGroup;
use App\Models\ChatGroupMember;
use App\Models\Message;
use App\Models\User;
use App\Services\FirebaseNotificationService;
use App\Services\InteractionPushService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class GroupPushNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_group_invite_dispatches_fcm_to_invitee(): void
    {
        $inviter = User::factory()->create(['handle' => 'Gazetteer@Dublin']);
        $invitee = User::factory()->create(['handle' => 'Barry@Cork']);
        $group = $this->makeGroupWithMember($inviter, 'Cork crew');

        $fcm = Mockery::mock(FirebaseNotificationService::class);
        $fcm->shouldReceive('sendToUser')
            ->once()
            ->with(
                (string) $invitee->id,
                'Cork crew',
                'Gazetteer@Dublin invited you to join Cork crew',
                Mockery::on(function (array $data) use ($group) {
                    return ($data['type'] ?? null) === 'group_invite'
                        && ($data['group_id'] ?? null) === (string) $group->id;
                })
            )
            ->andReturn(['sent' => 1, 'failed' => 0, 'configured' => true]);

        $this->app->instance(FirebaseNotificationService::class, $fcm);

        $this->actingAs($inviter, 'sanctum')
            ->postJson("/api/chat-groups/{$group->id}/invites", [
                'invitee_handle' => $invitee->handle,
            ])
            ->assertStatus(201);
    }

    public function test_group_message_pushes_other_members_not_sender(): void
    {
        $sender = User::factory()->create(['handle' => 'Alice@Cork']);
        $member = User::factory()->create(['handle' => 'Bob@Dublin']);
        $group = $this->makeGroupWithMember($sender, 'Night out');
        ChatGroupMember::create([
            'chat_group_id' => $group->id,
            'user_id' => $member->id,
            'role' => 'member',
        ]);

        $fcm = Mockery::mock(FirebaseNotificationService::class);
        $fcm->shouldReceive('sendToUser')
            ->once()
            ->with(
                (string) $member->id,
                'Night out',
                'Alice@Cork: On the way',
                Mockery::on(function (array $data) use ($group) {
                    return ($data['type'] ?? null) === 'group_chat'
                        && ($data['group_id'] ?? null) === (string) $group->id;
                })
            )
            ->andReturn(['sent' => 1, 'failed' => 0, 'configured' => true]);
        $fcm->shouldReceive('sendToUser')->with((string) $sender->id, Mockery::any(), Mockery::any(), Mockery::any())->never();

        $this->app->instance(FirebaseNotificationService::class, $fcm);

        $this->actingAs($sender, 'sanctum')
            ->postJson('/api/messages/send', [
                'chat_group_id' => $group->id,
                'text' => 'On the way',
            ])
            ->assertStatus(201);
    }

    public function test_system_group_messages_do_not_push(): void
    {
        $sender = User::factory()->create();
        $member = User::factory()->create();
        $group = $this->makeGroupWithMember($sender, 'Quiet');
        ChatGroupMember::create([
            'chat_group_id' => $group->id,
            'user_id' => $member->id,
            'role' => 'member',
        ]);

        $message = new Message([
            'conversation_id' => $group->conversation_id,
            'chat_group_id' => $group->id,
            'sender_handle' => $sender->handle,
            'text' => 'joined the group',
            'is_system_message' => true,
        ]);

        $fcm = Mockery::mock(FirebaseNotificationService::class);
        $fcm->shouldReceive('sendToUser')->never();

        (new InteractionPushService($fcm))->notifyGroupMessage($sender, $group, $message);
        $this->addToAssertionCount(1);
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

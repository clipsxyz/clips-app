<?php

namespace Tests\Feature;

use App\Events\MessageSent;
use App\Models\ChatGroup;
use App\Models\ChatGroupMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class MessageBroadcastTest extends TestCase
{
    use RefreshDatabase;

    public function test_sending_a_dm_dispatches_message_sent(): void
    {
        Event::fake([MessageSent::class]);

        $donny = User::factory()->create(['handle' => 'Donny@NewYorkState']);
        $gazetteer = User::factory()->create(['handle' => 'Gazetteer@Dublin']);

        $this->actingAs($donny, 'sanctum')
            ->postJson('/api/messages/send', [
                'recipient_handle' => $gazetteer->handle,
                'text' => 'hello from reverb',
            ])
            ->assertStatus(201);

        Event::assertDispatched(MessageSent::class, function (MessageSent $event) use ($gazetteer) {
            return $event->message->text === 'hello from reverb'
                && $event->message->recipient_handle === $gazetteer->handle;
        });
    }

    public function test_sending_a_group_message_dispatches_message_sent(): void
    {
        Event::fake([MessageSent::class]);

        $donny = User::factory()->create(['handle' => 'Donny@NewYorkState']);
        $group = ChatGroup::create([
            'name' => 'Test community',
            'creator_id' => $donny->id,
        ]);
        ChatGroupMember::create([
            'chat_group_id' => $group->id,
            'user_id' => $donny->id,
            'role' => 'admin',
        ]);

        $this->actingAs($donny, 'sanctum')
            ->postJson('/api/messages/send', [
                'chat_group_id' => $group->id,
                'text' => 'hello group',
            ])
            ->assertStatus(201);

        Event::assertDispatched(MessageSent::class, function (MessageSent $event) use ($group) {
            return $event->message->text === 'hello group'
                && (string) $event->message->chat_group_id === (string) $group->id;
        });
    }

    public function test_user_can_authorize_own_dm_channel_but_not_another(): void
    {
        $donny = User::factory()->create(['handle' => 'Donny@NewYorkState']);
        $gazetteer = User::factory()->create(['handle' => 'Gazetteer@Dublin']);

        $token = $donny->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/broadcasting/auth', [
                'socket_id' => '1234.5678',
                'channel_name' => 'private-chat.user.'.$donny->id,
            ])
            ->assertOk();

        $this->withToken($token)
            ->postJson('/api/broadcasting/auth', [
                'socket_id' => '1234.5678',
                'channel_name' => 'private-chat.user.'.$gazetteer->id,
            ])
            ->assertForbidden();
    }

    public function test_only_group_members_can_authorize_group_channel(): void
    {
        $donny = User::factory()->create(['handle' => 'Donny@NewYorkState']);
        $gazetteer = User::factory()->create(['handle' => 'Gazetteer@Dublin']);
        $group = ChatGroup::create([
            'name' => 'Test community',
            'creator_id' => $donny->id,
        ]);
        ChatGroupMember::create([
            'chat_group_id' => $group->id,
            'user_id' => $donny->id,
            'role' => 'admin',
        ]);

        $adminToken = $donny->createToken('test')->plainTextToken;
        $outsiderToken = $gazetteer->createToken('test')->plainTextToken;

        $this->withToken($adminToken)
            ->postJson('/api/broadcasting/auth', [
                'socket_id' => '1234.5678',
                'channel_name' => 'private-chat.group.'.$group->id,
            ])
            ->assertOk();

        Auth::forgetGuards();
        $this->flushHeaders();

        $this->withToken($outsiderToken)
            ->postJson('/api/broadcasting/auth', [
                'socket_id' => '1234.5678',
                'channel_name' => 'private-chat.group.'.$group->id,
            ])
            ->assertForbidden();
    }
}

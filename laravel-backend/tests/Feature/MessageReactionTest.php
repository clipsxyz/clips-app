<?php

namespace Tests\Feature;

use App\Models\ChatGroup;
use App\Models\ChatGroupMember;
use App\Models\Message;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageReactionTest extends TestCase
{
    use RefreshDatabase;

    public function test_reacting_notifies_the_author_and_does_not_add_a_message(): void
    {
        $author = User::factory()->create(['handle' => 'gazetteer@dublin']);
        $reactor = User::factory()->create(['handle' => 'gavin@ca']);

        $sent = $this->actingAs($author, 'sanctum')->postJson('/api/messages/send', [
            'recipient_handle' => $reactor->handle,
            'text' => 'Look at this',
        ]);
        $sent->assertStatus(201);
        $messageId = $sent->json('id');

        $before = Message::count();

        $this->actingAs($reactor, 'sanctum')
            ->postJson("/api/messages/{$messageId}/reactions", ['emoji' => '❤️'])
            ->assertOk()
            ->assertJsonPath('added', true)
            ->assertJsonPath('reactions.0.emoji', '❤️')
            ->assertJsonPath('reactions.0.users.0', 'gavin@ca');

        $this->assertSame($before, Message::count());
        $this->assertDatabaseHas('notifications', [
            'user_id' => $author->id,
            'type' => 'message_reaction',
            'from_handle' => 'gavin@ca',
            'to_handle' => 'gazetteer@dublin',
        ]);
        $this->assertSame(1, Notification::where('type', 'message_reaction')->count());

        $history = $this->actingAs($author, 'sanctum')
            ->getJson('/api/messages/conversation/' . rawurlencode($reactor->handle) . '/paged?limit=20');
        $history->assertOk();
        $this->assertSame('❤️', $history->json('items.0.reactions.0.emoji'));

        $this->actingAs($reactor, 'sanctum')
            ->postJson("/api/messages/{$messageId}/reactions", ['emoji' => '❤️'])
            ->assertOk()
            ->assertJsonPath('added', false)
            ->assertJsonPath('reactions', []);

        $this->assertSame(1, Notification::where('type', 'message_reaction')->count());
    }

    public function test_reacting_to_your_own_message_does_not_notify_you(): void
    {
        $author = User::factory()->create(['handle' => 'gazetteer@dublin']);
        $other = User::factory()->create(['handle' => 'gavin@ca']);

        $sent = $this->actingAs($author, 'sanctum')->postJson('/api/messages/send', [
            'recipient_handle' => $other->handle,
            'text' => 'Mine',
        ]);
        $messageId = $sent->json('id');

        $this->actingAs($author, 'sanctum')
            ->postJson("/api/messages/{$messageId}/reactions", ['emoji' => '🔥'])
            ->assertOk()
            ->assertJsonPath('added', true);

        $this->assertSame(0, Notification::where('type', 'message_reaction')->count());
    }

    public function test_group_reaction_notifies_only_the_author(): void
    {
        $author = User::factory()->create(['handle' => 'gazetteer@dublin']);
        $reactor = User::factory()->create(['handle' => 'gavin@ca']);
        $bystander = User::factory()->create(['handle' => 'trent@liverpool']);
        $outsider = User::factory()->create(['handle' => 'ava@galway']);

        $group = ChatGroup::create([
            'name' => 'The lads',
            'creator_id' => $author->id,
        ]);
        foreach ([$author, $reactor, $bystander] as $person) {
            ChatGroupMember::create([
                'chat_group_id' => $group->id,
                'user_id' => $person->id,
                'role' => $person->id === $author->id ? 'admin' : 'member',
            ]);
        }

        $sent = $this->actingAs($author, 'sanctum')->postJson('/api/messages/send', [
            'chat_group_id' => $group->id,
            'text' => 'Hey Everyone',
        ]);
        $sent->assertStatus(201);
        $messageId = $sent->json('id');
        $before = Message::count();

        $this->actingAs($reactor, 'sanctum')
            ->postJson("/api/messages/{$messageId}/reactions", ['emoji' => '😂'])
            ->assertOk()
            ->assertJsonPath('added', true);

        $this->assertSame($before, Message::count());
        $note = Notification::where('type', 'message_reaction')->first();
        $this->assertNotNull($note);
        $this->assertSame($author->id, $note->user_id);
        $this->assertSame($group->id, $note->chat_group_id);
        $this->assertSame(0, Notification::where('user_id', $bystander->id)->where('type', 'message_reaction')->count());

        $this->actingAs($outsider, 'sanctum')
            ->postJson("/api/messages/{$messageId}/reactions", ['emoji' => '😂'])
            ->assertStatus(403);
    }
}

<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageSourcePostTest extends TestCase
{
    use RefreshDatabase;

    public function test_source_post_id_is_persisted_and_returned(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();
        $post = Post::factory()->create();

        $response = $this->actingAs($sender, 'sanctum')->postJson('/api/messages/send', [
            'recipient_handle' => $recipient->handle,
            'text' => 'Thought you would like this',
            'source_post_id' => $post->id,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('source_post_id', $post->id);

        $this->assertDatabaseHas('messages', [
            'id' => $response->json('id'),
            'source_post_id' => $post->id,
            'text' => 'Thought you would like this',
        ]);
    }

    public function test_message_without_source_post_still_sends(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();

        $response = $this->actingAs($sender, 'sanctum')->postJson('/api/messages/send', [
            'recipient_handle' => $recipient->handle,
            'text' => 'Plain message',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('source_post_id', null);
    }
}

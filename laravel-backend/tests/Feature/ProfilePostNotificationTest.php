<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfilePostNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_bell_saves_and_a_new_post_notifies_the_subscriber(): void
    {
        $creator = User::factory()->create(['handle' => 'Trent66@Liverpool']);
        $subscriber = User::factory()->create(['handle' => 'Gazetteer@Dublin']);

        $this->actingAs($subscriber, 'sanctum')
            ->putJson('/api/users/'.$creator->handle.'/post-notifications', ['level' => 'all'])
            ->assertOk()
            ->assertJson(['level' => 'all']);

        $this->actingAs($subscriber, 'sanctum')
            ->getJson('/api/users/'.$creator->handle.'/post-notifications')
            ->assertOk()
            ->assertJson(['level' => 'all']);

        $this->actingAs($creator, 'sanctum')
            ->postJson('/api/posts', ['text' => 'Match day'])
            ->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $subscriber->id,
            'type' => 'new_post',
            'from_handle' => $creator->handle,
            'to_handle' => $subscriber->handle,
        ]);
        $this->assertSame(1, Notification::query()->where('type', 'new_post')->count());
    }

    public function test_turning_the_bell_off_stops_post_notifications(): void
    {
        $creator = User::factory()->create();
        $subscriber = User::factory()->create();

        $this->actingAs($subscriber, 'sanctum')
            ->putJson('/api/users/'.rawurlencode($creator->handle).'/post-notifications', ['level' => 'all'])
            ->assertOk();

        $this->actingAs($subscriber, 'sanctum')
            ->putJson('/api/users/'.rawurlencode($creator->handle).'/post-notifications', ['level' => 'off'])
            ->assertOk()
            ->assertJson(['level' => 'off']);

        $this->actingAs($creator, 'sanctum')
            ->postJson('/api/posts', ['text' => 'Quiet'])
            ->assertCreated();

        $this->assertDatabaseMissing('notifications', [
            'user_id' => $subscriber->id,
            'type' => 'new_post',
        ]);
    }
}

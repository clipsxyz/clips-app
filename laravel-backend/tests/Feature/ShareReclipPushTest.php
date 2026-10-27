<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Services\FirebaseNotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Mockery;
use Tests\TestCase;

class ShareReclipPushTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_share_dispatches_fcm_to_author(): void
    {
        $author = User::factory()->create(['handle' => 'Barry@Dublin']);
        $sharer = User::factory()->create(['handle' => 'Gazetteer@Cork']);
        $post = Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
        ]);

        $fcm = Mockery::mock(FirebaseNotificationService::class);
        $fcm->shouldReceive('sendToUser')
            ->once()
            ->with(
                (string) $author->id,
                'Gazetteer@Cork',
                'shared your post',
                Mockery::on(function (array $data) use ($post) {
                    return ($data['type'] ?? null) === 'share'
                        && ($data['post_id'] ?? null) === (string) $post->id;
                })
            )
            ->andReturn(['sent' => 1, 'failed' => 0, 'configured' => true]);

        $this->app->instance(FirebaseNotificationService::class, $fcm);

        $this->actingAs($sharer, 'sanctum')
            ->postJson("/api/posts/{$post->id}/share")
            ->assertStatus(200);
    }

    public function test_sharing_own_post_does_not_send_push(): void
    {
        $author = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
        ]);

        $fcm = Mockery::mock(FirebaseNotificationService::class);
        $fcm->shouldReceive('sendToUser')->never();
        $this->app->instance(FirebaseNotificationService::class, $fcm);

        $this->actingAs($author, 'sanctum')
            ->postJson("/api/posts/{$post->id}/share")
            ->assertStatus(200);
    }

    public function test_share_respects_shares_preference(): void
    {
        $author = User::factory()->create();
        $sharer = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
        ]);

        DB::table('notification_preferences')->insert([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'preferences' => json_encode(['shares' => false]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $fcm = Mockery::mock(FirebaseNotificationService::class);
        $fcm->shouldReceive('sendToUser')->never();
        $this->app->instance(FirebaseNotificationService::class, $fcm);

        $this->actingAs($sharer, 'sanctum')
            ->postJson("/api/posts/{$post->id}/share")
            ->assertStatus(200);
    }

    public function test_reclip_dispatches_fcm_to_original_author(): void
    {
        $author = User::factory()->create(['handle' => 'Barry@Dublin']);
        $reclipper = User::factory()->create(['handle' => 'Gazetteer@Cork']);
        $post = Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
        ]);

        $fcm = Mockery::mock(FirebaseNotificationService::class);
        $fcm->shouldReceive('sendToUser')
            ->once()
            ->with(
                (string) $author->id,
                'Gazetteer@Cork',
                'reclipped your post',
                Mockery::on(function (array $data) use ($post) {
                    return ($data['type'] ?? null) === 'reclip'
                        && ($data['post_id'] ?? null) === (string) $post->id;
                })
            )
            ->andReturn(['sent' => 1, 'failed' => 0, 'configured' => true]);

        $this->app->instance(FirebaseNotificationService::class, $fcm);

        $this->actingAs($reclipper, 'sanctum')
            ->postJson("/api/posts/{$post->id}/reclip")
            ->assertStatus(201);
    }

    public function test_idempotent_reclip_does_not_send_a_second_push(): void
    {
        $author = User::factory()->create();
        $reclipper = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
        ]);

        $fcm = Mockery::mock(FirebaseNotificationService::class);
        $fcm->shouldReceive('sendToUser')
            ->once()
            ->andReturn(['sent' => 1, 'failed' => 0, 'configured' => true]);
        $this->app->instance(FirebaseNotificationService::class, $fcm);

        $this->actingAs($reclipper, 'sanctum')
            ->postJson("/api/posts/{$post->id}/reclip")
            ->assertStatus(201);

        $this->actingAs($reclipper, 'sanctum')
            ->postJson("/api/posts/{$post->id}/reclip")
            ->assertStatus(200);
    }
}

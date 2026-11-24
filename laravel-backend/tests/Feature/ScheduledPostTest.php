<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ScheduledPostTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    public function test_future_posts_stay_out_of_public_feeds_until_their_time(): void
    {
        $author = User::factory()->create([
            'location_local' => 'Finglas',
            'location_regional' => 'Dublin',
            'posts_count' => 0,
        ]);
        $when = now()->addHour()->startOfMinute();

        $created = $this->actingAs($author, 'sanctum')
            ->postJson('/api/posts', [
                'text' => 'Opens later',
                'location' => 'Finglas',
                'scheduled_at' => $when->toISOString(),
            ]);

        $created->assertStatus(201)
            ->assertJsonPath('status', 'scheduled');

        $scheduledId = $created->json('id');
        $this->assertNotNull($scheduledId);
        $this->assertSame(0, $author->fresh()->posts_count);

        $live = $this->actingAs($author, 'sanctum')
            ->postJson('/api/posts', [
                'text' => 'On the feed now',
                'location' => 'Finglas',
            ]);
        $live->assertStatus(201)->assertJsonPath('status', 'published');

        $feed = $this->getJson('/api/posts?filter=Finglas&userId='.$author->id);
        $feed->assertOk();
        $ids = collect($feed->json('items'))->pluck('id');
        $this->assertTrue($ids->contains($live->json('id')));
        $this->assertFalse($ids->contains($scheduledId));

        $mine = $this->actingAs($author, 'sanctum')->getJson('/api/posts/scheduled');
        $mine->assertOk();
        $this->assertTrue(collect($mine->json('items'))->pluck('id')->contains($scheduledId));

        $later = $when->copy()->addHours(2);
        $this->actingAs($author, 'sanctum')
            ->patchJson('/api/posts/'.$scheduledId.'/schedule', [
                'scheduled_at' => $later->toISOString(),
            ])
            ->assertOk()
            ->assertJsonPath('status', 'scheduled');

        $this->assertTrue(
            Post::query()->find($scheduledId)->scheduled_at->equalTo($later)
        );

        Post::query()->whereKey($scheduledId)->update([
            'scheduled_at' => now()->subMinute(),
        ]);

        $this->artisan('posts:publish-scheduled')->assertSuccessful();

        $published = Post::query()->find($scheduledId);
        $this->assertSame('published', $published->status);
        $this->assertTrue($published->created_at->equalTo($published->scheduled_at));
        $this->assertSame(2, $author->fresh()->posts_count);

        $after = $this->getJson('/api/posts?filter=Finglas&userId='.$author->id);
        $this->assertTrue(collect($after->json('items'))->pluck('id')->contains($scheduledId));
    }

    public function test_author_can_cancel_a_scheduled_post_and_past_times_are_rejected(): void
    {
        $author = User::factory()->create();

        $this->actingAs($author, 'sanctum')
            ->postJson('/api/posts', [
                'text' => 'Too soon',
                'scheduled_at' => now()->subMinute()->toISOString(),
            ])
            ->assertStatus(422);

        $created = $this->actingAs($author, 'sanctum')
            ->postJson('/api/posts', [
                'text' => 'Will cancel',
                'scheduled_at' => now()->addDay()->toISOString(),
            ]);
        $created->assertStatus(201);
        $id = $created->json('id');

        $this->actingAs($author, 'sanctum')
            ->deleteJson('/api/posts/'.$id.'/schedule')
            ->assertOk();

        $this->assertNull(Post::query()->find($id));
    }

    public function test_author_can_publish_a_scheduled_post_immediately(): void
    {
        $author = User::factory()->create(['posts_count' => 0]);

        $created = $this->actingAs($author, 'sanctum')
            ->postJson('/api/posts', [
                'text' => 'Waiting',
                'scheduled_at' => now()->addHours(3)->toISOString(),
            ]);
        $created->assertStatus(201);
        $id = $created->json('id');
        $this->assertSame(0, $author->fresh()->posts_count);

        $this->actingAs($author, 'sanctum')
            ->putJson('/api/posts/'.$id, ['text' => 'Updated caption'])
            ->assertOk()
            ->assertJsonPath('text', 'Updated caption');

        $published = $this->actingAs($author, 'sanctum')
            ->postJson('/api/posts/'.$id.'/publish-now');
        $published->assertOk()->assertJsonPath('status', 'published');

        $row = Post::query()->find($id);
        $this->assertSame('published', $row->status);
        $this->assertNull($row->scheduled_at);
        $this->assertTrue($row->created_at->greaterThan(now()->subMinute()));
        $this->assertSame(1, $author->fresh()->posts_count);

        $this->actingAs($author, 'sanctum')
            ->getJson('/api/posts/scheduled')
            ->assertOk()
            ->assertJsonCount(0, 'items');

        $this->actingAs($author, 'sanctum')
            ->postJson('/api/posts/'.$id.'/publish-now')
            ->assertNotFound();
        $this->assertSame(1, $author->fresh()->posts_count);
    }

    public function test_opening_the_feed_publishes_a_post_whose_time_has_passed(): void
    {
        $author = User::factory()->create([
            'location_local' => 'Finglas',
            'location_regional' => 'Dublin',
            'posts_count' => 0,
        ]);
        $when = now()->subMinute()->startOfMinute();

        $created = $this->actingAs($author, 'sanctum')
            ->postJson('/api/posts', [
                'text' => 'Due already',
                'location' => 'Finglas',
                'scheduled_at' => now()->addHour()->toISOString(),
            ]);
        $created->assertStatus(201);
        $id = $created->json('id');

        Post::query()->whereKey($id)->update([
            'scheduled_at' => $when,
        ]);

        $feed = $this->getJson('/api/posts?filter=Finglas&userId='.$author->id);
        $feed->assertOk();
        $this->assertTrue(collect($feed->json('items'))->pluck('id')->contains($id));

        $row = Post::query()->find($id);
        $this->assertSame('published', $row->status);
        $this->assertTrue($row->created_at->equalTo($when));
        $this->assertSame(1, $author->fresh()->posts_count);
    }
}

<?php

namespace Tests\Feature;

use App\Models\Story;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ScheduledStoryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    public function test_scheduled_shorts_stay_off_the_rail_until_they_publish(): void
    {
        $author = User::factory()->create();
        $when = now()->addHours(3)->startOfMinute();

        $created = $this->actingAs($author, 'sanctum')
            ->postJson('/api/stories', [
                'text' => 'Short later',
                'media_url' => 'https://example.com/short.mp4',
                'media_type' => 'video',
                'scheduled_at' => $when->toISOString(),
            ]);

        $created->assertStatus(201)->assertJsonPath('status', 'scheduled');
        $id = $created->json('id');

        $rail = $this->actingAs($author, 'sanctum')->getJson('/api/stories');
        $rail->assertOk();
        $railIds = collect($rail->json())->flatMap(fn ($group) => collect($group['stories'] ?? [])->pluck('id'));
        $this->assertFalse($railIds->contains($id));

        $profile = $this->actingAs($author, 'sanctum')->getJson('/api/stories/user/'.$author->handle);
        $profile->assertOk();
        $this->assertFalse(collect($profile->json())->pluck('id')->contains($id));

        $queue = $this->actingAs($author, 'sanctum')->getJson('/api/stories/scheduled');
        $queue->assertOk();
        $this->assertTrue(collect($queue->json('items'))->pluck('id')->contains($id));

        $this->actingAs($author, 'sanctum')
            ->patchJson('/api/stories/'.$id.'/caption', ['text' => 'Updated short'])
            ->assertOk()
            ->assertJsonPath('text', 'Updated short');

        $later = $when->copy()->addHour();
        $this->actingAs($author, 'sanctum')
            ->patchJson('/api/stories/'.$id.'/schedule', ['scheduled_at' => $later->toISOString()])
            ->assertOk()
            ->assertJsonPath('status', 'scheduled');

        $published = $this->actingAs($author, 'sanctum')
            ->postJson('/api/stories/'.$id.'/publish-now');
        $published->assertOk()->assertJsonPath('status', 'published');

        $row = Story::query()->find($id);
        $this->assertSame('published', $row->status);
        $this->assertNull($row->scheduled_at);
        $this->assertTrue($row->expires_at->greaterThan(now()->addHours(23)));

        $after = $this->actingAs($author, 'sanctum')->getJson('/api/stories/user/'.$author->handle);
        $this->assertTrue(collect($after->json())->pluck('id')->contains($id));

        $this->actingAs($author, 'sanctum')
            ->postJson('/api/stories/'.$id.'/publish-now')
            ->assertNotFound();
    }

    public function test_author_can_cancel_a_scheduled_short_and_past_times_are_rejected(): void
    {
        $author = User::factory()->create();

        $this->actingAs($author, 'sanctum')
            ->postJson('/api/stories', [
                'text' => 'Too soon',
                'scheduled_at' => now()->subMinute()->toISOString(),
            ])
            ->assertStatus(422);

        $created = $this->actingAs($author, 'sanctum')
            ->postJson('/api/stories', [
                'text' => 'Will cancel',
                'scheduled_at' => now()->addDay()->toISOString(),
            ]);
        $created->assertStatus(201);
        $id = $created->json('id');

        Story::query()->whereKey($id)->update(['scheduled_at' => now()->subMinute()]);
        $this->artisan('posts:publish-scheduled')->assertSuccessful();
        $published = Story::query()->find($id);
        $this->assertSame('published', $published->status);
        $this->assertTrue($published->created_at->equalTo($published->scheduled_at));

        $another = $this->actingAs($author, 'sanctum')
            ->postJson('/api/stories', [
                'text' => 'Drop me',
                'scheduled_at' => now()->addHours(2)->toISOString(),
            ]);
        $another->assertStatus(201);
        $dropId = $another->json('id');

        $this->actingAs($author, 'sanctum')
            ->deleteJson('/api/stories/'.$dropId.'/schedule')
            ->assertOk();
        $this->assertNull(Story::query()->find($dropId));
    }

    public function test_opening_shorts_publishes_a_short_whose_time_has_passed(): void
    {
        $author = User::factory()->create();
        $when = now()->subMinute()->startOfMinute();

        $created = $this->actingAs($author, 'sanctum')
            ->postJson('/api/stories', [
                'text' => 'Due short',
                'scheduled_at' => now()->addHour()->toISOString(),
            ]);
        $created->assertStatus(201);
        $id = $created->json('id');
        Story::query()->whereKey($id)->update(['scheduled_at' => $when]);

        $profile = $this->actingAs($author, 'sanctum')->getJson('/api/stories/user/'.$author->handle);
        $profile->assertOk();
        $this->assertTrue(collect($profile->json())->pluck('id')->contains($id));

        $row = Story::query()->find($id);
        $this->assertSame('published', $row->status);
        $this->assertTrue($row->created_at->equalTo($when));
        $this->assertTrue($row->expires_at->equalTo($when->copy()->addHours(24)));
    }
}

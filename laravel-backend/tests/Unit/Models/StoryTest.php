<?php

namespace Tests\Unit\Models;

use App\Models\Story;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class StoryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Schema::disableForeignKeyConstraints();
    }

    protected function tearDown(): void
    {
        Schema::enableForeignKeyConstraints();
        parent::tearDown();
    }

    public function test_active_scope_returns_only_non_expired_stories(): void
    {
        $user = User::factory()->create();
        $activeStory = Story::factory()->forUser($user)->create(['expires_at' => now()->addHour()]);
        Story::factory()->forUser($user)->expired()->create();

        $results = Story::active()->pluck('id')->all();

        $this->assertContains($activeStory->id, $results);
        $this->assertCount(1, $results);
    }

    public function test_expired_scope_returns_only_expired_stories(): void
    {
        $user = User::factory()->create();
        Story::factory()->forUser($user)->create(['expires_at' => now()->addHour()]);
        $expiredStory = Story::factory()->forUser($user)->expired()->create();

        $results = Story::expired()->pluck('id')->all();

        $this->assertContains($expiredStory->id, $results);
        $this->assertCount(1, $results);
    }

    public function test_for_user_scope_filters_by_user_id(): void
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();
        $story1 = Story::factory()->forUser($user1)->create();
        Story::factory()->forUser($user2)->create();

        $results = Story::forUser($user1->id)->pluck('id')->all();

        $this->assertContains($story1->id, $results);
        $this->assertCount(1, $results);
    }

    public function test_by_media_type_scope_filters_by_media_type(): void
    {
        $user = User::factory()->create();
        $imageStory = Story::factory()->forUser($user)->withMedia()->create(['media_type' => 'image']);
        Story::factory()->forUser($user)->create(['media_type' => null, 'text' => 'Text only']);

        $results = Story::byMediaType('image')->pluck('id')->all();

        $this->assertContains($imageStory->id, $results);
        $this->assertCount(1, $results);
    }

    public function test_is_active_returns_true_when_expires_at_in_future(): void
    {
        $user = User::factory()->create();
        $story = Story::factory()->forUser($user)->create(['expires_at' => now()->addHour()]);
        $this->assertTrue($story->isActive());
    }

    public function test_is_active_returns_false_when_expired(): void
    {
        $user = User::factory()->create();
        $story = Story::factory()->forUser($user)->expired()->create();
        $this->assertFalse($story->isActive());
    }

    public function test_is_expired_returns_true_when_expires_at_in_past(): void
    {
        $user = User::factory()->create();
        $story = Story::factory()->forUser($user)->expired()->create();
        $this->assertTrue($story->isExpired());
    }

    public function test_is_expired_returns_false_when_not_expired(): void
    {
        $user = User::factory()->create();
        $story = Story::factory()->forUser($user)->create(['expires_at' => now()->addHour()]);
        $this->assertFalse($story->isExpired());
    }
}

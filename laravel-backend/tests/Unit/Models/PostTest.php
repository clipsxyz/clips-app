<?php

namespace Tests\Unit\Models;

use App\Http\Controllers\Api\PostController;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PostTest extends TestCase
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

    public function test_not_reclipped_scope_excludes_reclipped_posts(): void
    {
        $user = User::factory()->create();

        $originalPost = Post::factory()->create([
            'user_id' => $user->id,
            'is_reclipped' => false,
        ]);

        $reclippedPost = Post::factory()->create([
            'user_id' => $user->id,
            'is_reclipped' => true,
            'original_post_id' => $originalPost->id,
        ]);

        $results = Post::notReclipped()->pluck('id')->all();

        $this->assertContains($originalPost->id, $results);
        $this->assertNotContains($reclippedPost->id, $results);
    }

    public function test_by_location_scope_filters_by_author_profile(): void
    {
        $dublinAuthor = User::factory()->create([
            'location_local' => 'Finglas',
            'location_regional' => 'Dublin',
            'location_national' => 'Ireland',
        ]);
        $galwayAuthor = User::factory()->create([
            'location_local' => 'Galway',
            'location_regional' => 'Galway',
            'location_national' => 'Ireland',
        ]);

        $dublinAuthorPost = Post::factory()->create([
            'user_id' => $dublinAuthor->id,
            'location_label' => 'London, UK',
        ]);
        Post::factory()->create([
            'user_id' => $galwayAuthor->id,
            'location_label' => 'Dublin, Ireland',
        ]);

        $results = Post::byLocation('Dublin')->pluck('id')->all();

        $this->assertContains($dublinAuthorPost->id, $results);
        $this->assertCount(1, $results);
    }

    public function test_by_location_uses_author_profile_not_post_tag(): void
    {
        $dublinAuthor = User::factory()->create([
            'location_local' => 'Finglas',
            'location_regional' => 'Dublin',
            'location_national' => 'Ireland',
        ]);
        $galwayAuthor = User::factory()->create([
            'location_local' => 'Oranmore',
            'location_regional' => 'Galway',
            'location_national' => 'Ireland',
        ]);

        $dublinAuthorSpainTag = Post::factory()->create([
            'user_id' => $dublinAuthor->id,
            'location_label' => 'Madrid, Spain',
            'venue' => 'Plaza Mayor',
        ]);
        $galwayAuthorSpainTag = Post::factory()->create([
            'user_id' => $galwayAuthor->id,
            'location_label' => 'Barcelona, Spain',
            'venue' => 'Sagrada Familia',
        ]);

        $dublinIds = Post::byLocation('Dublin')->pluck('id')->all();
        $galwayIds = Post::byLocation('Galway')->pluck('id')->all();
        $spainIds = Post::byLocation('Spain')->pluck('id')->all();
        $manchesterIds = Post::byLocation('Manchester')->pluck('id')->all();

        $this->assertContains($dublinAuthorSpainTag->id, $dublinIds);
        $this->assertNotContains($galwayAuthorSpainTag->id, $dublinIds);
        $this->assertContains($galwayAuthorSpainTag->id, $galwayIds);
        $this->assertNotContains($dublinAuthorSpainTag->id, $galwayIds);
        $this->assertNotContains($dublinAuthorSpainTag->id, $spainIds);
        $this->assertNotContains($galwayAuthorSpainTag->id, $spainIds);
        $this->assertNotContains($dublinAuthorSpainTag->id, $manchesterIds);
        $this->assertNotContains($galwayAuthorSpainTag->id, $manchesterIds);
    }

    public function test_by_location_venue_prefix_still_matches_post_venue(): void
    {
        $author = User::factory()->create([
            'location_local' => 'Oranmore',
            'location_regional' => 'Galway',
            'location_national' => 'Ireland',
        ]);
        $post = Post::factory()->create([
            'user_id' => $author->id,
            'venue' => 'Eyre Square',
        ]);

        $this->assertContains($post->id, Post::byLocation('venue:Eyre Square')->pluck('id')->all());
        $this->assertNotContains($post->id, Post::byLocation('Spain')->pluck('id')->all());
    }

    public function test_is_liked_by_returns_true_when_like_exists(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);

        // Use the relationship helper so the pivot row matches
        // the model's belongsToMany configuration.
        $user->postLikes()->attach($post->id);

        $this->assertTrue($post->fresh()->isLikedBy($user));
    }

    public function test_is_bookmarked_by_checks_post_bookmarks_pivot(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);

        $user->bookmarks()->attach($post->id);

        $this->assertTrue($post->fresh()->isBookmarkedBy($user));
    }

    public function test_is_viewed_by_checks_post_views_pivot(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);

        $user->views()->attach($post->id);

        $this->assertTrue($post->fresh()->isViewedBy($user));
    }

    public function test_is_reclipped_by_checks_post_reclips_pivot(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);

        $user->reclips()->attach($post->id, ['user_handle' => $user->handle]);

        $this->assertTrue($post->fresh()->isReclippedBy($user));
    }

    public function test_is_following_author_uses_followers_relationship(): void
    {
        $author = User::factory()->create();
        $follower = User::factory()->create();

        $post = Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
        ]);

        // Attach follower using the relationship so the pivot row
        // is shaped exactly like the model expects.
        $author->followers()->attach($follower->id, ['status' => 'accepted']);

        $this->assertTrue($post->fresh()->isFollowingAuthor($follower));
    }

    public function test_to_api_array_emits_author_location_tiers(): void
    {
        // Regression: the feed payload carried only handle/display_name/avatar_url, so
        // transformLaravelPost resolved every tier to undefined and the client-side
        // location guard dropped the entire Ireland feed. Following kept working because
        // it skips that guard, which is exactly the reported symptom.
        $user = User::factory()->create([
            'location_local' => 'Oranmore',
            'location_regional' => 'Galway',
            'location_national' => 'Ireland',
        ]);
        $post = Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
        ]);
        $post->load(['user:id,handle,display_name,avatar_url,location_local,location_regional,location_national']);

        $payload = PostController::toApiArray($post, null);

        // camelCase nested keys: what the RN client reads from the author object.
        $this->assertSame('Oranmore', $payload['user']['local']);
        $this->assertSame('Galway', $payload['user']['regional']);
        $this->assertSame('Ireland', $payload['user']['national']);

        // Top-level duplicates: the `|| response.userLocal` fallback in transformLaravelPost.
        $this->assertSame('Oranmore', $payload['userLocal']);
        $this->assertSame('Galway', $payload['userRegional']);
        $this->assertSame('Ireland', $payload['userNational']);
    }

    public function test_to_api_array_omits_author_location_when_relation_not_loaded(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
        ]);

        $payload = PostController::toApiArray($post, null);

        $this->assertArrayNotHasKey('userLocal', $payload);
        $this->assertArrayNotHasKey('userRegional', $payload);
        $this->assertArrayNotHasKey('userNational', $payload);
    }

    public function test_by_location_national_scope_uses_author_home_not_post_tag(): void
    {
        $galway = User::factory()->create([
            'location_local' => 'Oranmore',
            'location_regional' => 'Galway',
            'location_national' => 'Ireland',
        ]);
        $galwayPost = Post::factory()->create([
            'user_id' => $galway->id,
            'user_handle' => $galway->handle,
            'location_label' => 'Madrid, Spain',
        ]);

        $english = User::factory()->create([
            'location_local' => 'London',
            'location_regional' => 'England',
            'location_national' => 'United Kingdom',
        ]);
        Post::factory()->create([
            'user_id' => $english->id,
            'user_handle' => $english->handle,
            'location_label' => 'Galway, Ireland',
        ]);

        $irelandIds = Post::notReclipped()->byLocation('Ireland')->pluck('id')->all();

        $this->assertContains($galwayPost->id, $irelandIds);

        $this->assertContains(
            $galwayPost->id,
            Post::notReclipped()->byLocation('Galway')->pluck('id')->all()
        );
        $this->assertNotContains(
            $galwayPost->id,
            Post::notReclipped()->byLocation('Dublin')->pluck('id')->all()
        );
        $this->assertNotContains(
            $galwayPost->id,
            Post::notReclipped()->byLocation('Spain')->pluck('id')->all()
        );
    }

    public function test_by_location_country_rolls_up_spanish_author_cities(): void
    {
        $author = User::factory()->create([
            'location_local' => 'Madrid',
            'location_regional' => 'Madrid',
            'location_national' => 'Spain',
        ]);
        $madrid = Post::factory()->create([
            'user_id' => $author->id,
            'location_label' => 'Temple Bar, Dublin',
        ]);
        $barcelona = Post::factory()->create([
            'user_id' => $author->id,
            'location_label' => 'Galway',
        ]);
        $irish = User::factory()->create([
            'location_local' => 'Dublin',
            'location_regional' => 'Dublin',
            'location_national' => 'Ireland',
        ]);
        $dublin = Post::factory()->create([
            'user_id' => $irish->id,
            'location_label' => 'Madrid, Spain',
            'location_national' => 'Spain',
        ]);

        $spainIds = Post::byLocation('Spain')->pluck('id')->all();

        $this->assertContains($madrid->id, $spainIds);
        $this->assertContains($barcelona->id, $spainIds);
        $this->assertNotContains($dublin->id, $spainIds);
    }

    public function test_resolved_thumbnail_url_prefers_column_then_media_items_poster(): void
    {
        $user = User::factory()->create();
        $fromColumn = Post::factory()->create([
            'user_id' => $user->id,
            'media_type' => 'video',
            'media_url' => 'https://example.com/clip.mp4',
            'thumbnail_url' => 'https://example.com/from-column.jpg',
        ]);
        $fromItems = Post::factory()->create([
            'user_id' => $user->id,
            'media_type' => 'video',
            'media_url' => 'https://example.com/clip.mp4',
            'thumbnail_url' => null,
            'media_items' => [[
                'url' => 'https://example.com/clip.mp4',
                'type' => 'video',
                'posterUrl' => 'https://example.com/from-items.jpg',
            ]],
        ]);

        $this->assertSame('https://example.com/from-column.jpg', $fromColumn->resolvedThumbnailUrl());
        $this->assertSame('https://example.com/from-items.jpg', $fromItems->resolvedThumbnailUrl());
    }
}


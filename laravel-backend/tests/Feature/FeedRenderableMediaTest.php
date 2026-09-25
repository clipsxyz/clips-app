<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * The feed must never hand back a text-only link/share card: the client used to
 * strip those itself and then walk the cursor forward when a whole 16-post page
 * was stripped, which stalled the National tab and could end pagination outright.
 */
class FeedRenderableMediaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    private function viewer(): User
    {
        return User::factory()->create(['location_national' => 'USA']);
    }

    /** Text-only share card: has a link_preview, nothing renderable. */
    private function linkSharePost(User $author, string $at = 'Dublin'): Post
    {
        return Post::create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'text_content' => 'check this out',
            'location_label' => $at,
            'link_preview' => ['url' => 'https://example.com/article', 'title' => 'Article'],
        ]);
    }

    private function videoPost(User $author, string $at = 'Dublin'): Post
    {
        return Post::create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'text_content' => 'clip',
            'location_label' => $at,
            'media_url' => 'https://example.com/video.mp4',
            'media_type' => 'video',
        ]);
    }

    private function mediaItemsPost(User $author, array $items, ?array $preview = null): Post
    {
        return Post::create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'text_content' => 'carousel',
            'location_label' => 'Dublin',
            'media_items' => $items,
            'link_preview' => $preview,
        ]);
    }

    public function test_flag_is_computed_on_create_for_each_media_shape(): void
    {
        $user = $this->viewer();

        $this->assertFalse($this->linkSharePost($user)->has_renderable_media);
        $this->assertTrue($this->videoPost($user)->has_renderable_media);
        $this->assertTrue($this->mediaItemsPost($user, [['url' => 'https://example.com/a.jpg']])->has_renderable_media);
        // media_items present but every url blank -> still not renderable.
        $this->assertFalse($this->mediaItemsPost($user, [['url' => '  '], ['url' => '']])->has_renderable_media);
        // A link preview with media alongside it is NOT a link-share card.
        $this->assertTrue($this->mediaItemsPost($user, [['url' => 'https://example.com/a.jpg']], ['url' => 'https://example.com'])->has_renderable_media);
    }

    public function test_flag_recomputes_when_media_is_added_later(): void
    {
        $user = $this->viewer();
        $post = $this->linkSharePost($user);
        $this->assertFalse($post->fresh()->has_renderable_media);

        $post->media_items = [['url' => 'https://example.com/poster.jpg']];
        $post->save();

        $this->assertTrue($post->fresh()->has_renderable_media);
    }

    public function test_flag_is_not_mass_assignable(): void
    {
        $user = $this->viewer();
        $post = $this->linkSharePost($user);

        $spoofed = Post::create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
            'text_content' => 'spoof',
            'location_label' => 'Dublin',
            'link_preview' => ['url' => 'https://example.com'],
            'has_renderable_media' => true,
        ]);

        $this->assertFalse($spoofed->fresh()->has_renderable_media);
        $this->assertFalse($post->fresh()->has_renderable_media);
    }

    public function test_national_feed_omits_link_share_posts(): void
    {
        $viewer = $this->viewer();
        $author = User::factory()->create(['location_national' => 'USA']);

        $linkShare = $this->linkSharePost($author);
        $keep = $this->videoPost($author);

        $res = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts?filter=USA&limit=20');

        $ids = collect($res->json('items'))->pluck('id');
        $this->assertFalse($ids->contains($linkShare->id), 'link-share post leaked into the National feed');
        $this->assertTrue($ids->contains($keep->id));
    }

    public function test_local_feed_omits_link_share_posts(): void
    {
        $viewer = $this->viewer();
        $author = User::factory()->create();

        $linkShare = $this->linkSharePost($author, 'Dublin');
        $keep = $this->videoPost($author, 'Dublin');

        $res = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts?filter=Dublin&limit=20');

        $ids = collect($res->json('items'))->pluck('id');
        $this->assertFalse($ids->contains($linkShare->id));
        $this->assertTrue($ids->contains($keep->id));
    }

    public function test_following_feed_omits_link_share_posts(): void
    {
        $viewer = $this->viewer();
        $author = User::factory()->create();
        DB::table('user_follows')->insert([
            'follower_id' => $viewer->id,
            'following_id' => $author->id,
            'status' => 'accepted',
        ]);

        $linkShare = $this->linkSharePost($author);
        $keep = $this->videoPost($author);

        $res = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts?filter=Following&limit=20');

        $ids = collect($res->json('items'))->pluck('id');
        $this->assertFalse($ids->contains($linkShare->id));
        $this->assertTrue($ids->contains($keep->id));
    }

    public function test_text_only_post_without_link_preview_is_kept(): void
    {
        $viewer = $this->viewer();
        $author = User::factory()->create(['location_national' => 'USA']);

        $textOnly = Post::create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'text_content' => 'just words, no link, no media',
            'location_label' => 'Dublin',
        ]);

        $res = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts?filter=USA&limit=20');

        $this->assertTrue(collect($res->json('items'))->pluck('id')->contains($textOnly->id));
    }

    public function test_a_page_entirely_made_of_link_shares_still_returns_a_full_page(): void
    {
        // The exact stall: 16 link-share posts ahead of real content. With SQL-side
        // filtering the page is filled from further down instead of coming back short.
        $viewer = $this->viewer();
        $author = User::factory()->create(['location_national' => 'USA']);

        $linkShares = [];
        for ($i = 0; $i < 20; $i++) {
            $linkShares[] = $this->linkSharePost($author);
        }
        $keep = [];
        for ($i = 0; $i < 20; $i++) {
            $keep[] = $this->videoPost($author);
        }

        $res = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts?filter=USA&limit=16');

        $items = collect($res->json('items'));
        $this->assertCount(16, $items, 'expected a full page once link-share posts are filtered in SQL');

        $linkShareIds = collect($linkShares)->pluck('id');
        $keepIds = collect($keep)->pluck('id');

        $this->assertEmpty(
            $items->pluck('id')->intersect($linkShareIds),
            'a page was padded with link-share posts'
        );
        // Every row came from the renderable set — none of the page was wasted.
        $this->assertCount(16, $items->pluck('id')->intersect($keepIds));
    }
}

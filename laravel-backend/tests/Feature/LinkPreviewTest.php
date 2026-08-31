<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\LinkPreviewService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class LinkPreviewTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    public function test_extracts_first_http_url_from_text(): void
    {
        $service = new LinkPreviewService;
        $this->assertSame(
            'https://www.youtube.com/watch?v=abc123',
            $service->extractFirstUrl('Check this https://www.youtube.com/watch?v=abc123 right now')
        );
        $this->assertNull($service->extractFirstUrl('no link here'));
    }

    public function test_rejects_private_urls(): void
    {
        $service = new LinkPreviewService;
        $this->assertNull($service->fetch('http://127.0.0.1/secret'));
        $this->assertNull($service->fetch('http://localhost/admin'));
    }

    public function test_fetches_youtube_oembed_preview(): void
    {
        Http::fake([
            'https://www.youtube.com/oembed*' => Http::response([
                'title' => 'Demo clip',
                'author_name' => 'Clips',
                'provider_name' => 'YouTube',
                'thumbnail_url' => 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
            ], 200),
        ]);

        $preview = (new LinkPreviewService)->fetch('https://www.youtube.com/watch?v=abc');

        $this->assertNotNull($preview);
        $this->assertSame('Demo clip', $preview['title']);
        $this->assertSame('YouTube', $preview['source']);
        $this->assertSame('https://i.ytimg.com/vi/abc/hqdefault.jpg', $preview['image_url']);
    }

    public function test_parses_open_graph_tags(): void
    {
        Http::fake([
            'https://example.com/article' => Http::response(
                '<html><head>'
                .'<meta property="og:title" content="Example article">'
                .'<meta property="og:description" content="A demo page">'
                .'<meta property="og:image" content="https://example.com/cover.jpg">'
                .'<meta property="og:site_name" content="Example">'
                .'</head></html>',
                200
            ),
        ]);

        $preview = (new LinkPreviewService)->fetch('https://example.com/article');

        $this->assertSame('Example article', $preview['title']);
        $this->assertSame('A demo page', $preview['description']);
        $this->assertSame('https://example.com/cover.jpg', $preview['image_url']);
        $this->assertSame('Example', $preview['source']);
    }

    public function test_authenticated_preview_endpoint_returns_og_payload(): void
    {
        Http::fake([
            'https://example.com/hello' => Http::response(
                '<html><head><meta property="og:title" content="Hello"><meta property="og:image" content="https://example.com/h.jpg"></head></html>',
                200
            ),
        ]);

        $user = User::factory()->create();
        $this->actingAs($user, 'sanctum')
            ->getJson('/api/link-preview?url='.urlencode('https://example.com/hello'))
            ->assertOk()
            ->assertJsonPath('title', 'Hello')
            ->assertJsonPath('url', 'https://example.com/hello');
    }

    public function test_creating_a_post_persists_link_preview_from_body(): void
    {
        Http::fake([
            'https://www.tiktok.com/oembed*' => Http::response([
                'title' => 'A TikTok',
                'provider_name' => 'TikTok',
                'thumbnail_url' => 'https://example.com/tiktok.jpg',
            ], 200),
        ]);

        $user = User::factory()->create();
        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/posts', [
                'text' => 'Watch this https://www.tiktok.com/@user/video/123',
                'location' => 'Dublin',
            ])
            ->assertStatus(201);

        $this->assertSame('A TikTok', $response->json('link_preview.title'));
        $this->assertSame('TikTok', $response->json('link_preview.source'));
        $this->assertDatabaseHas('posts', [
            'id' => $response->json('id'),
        ]);
        $this->assertSame(
            'A TikTok',
            \App\Models\Post::find($response->json('id'))?->link_preview['title'] ?? null
        );
    }

    public function test_direct_mp4_url_is_marked_as_inline_video(): void
    {
        Http::fake();

        $preview = (new LinkPreviewService)->fetch('https://cdn.example.com/clips/demo.mp4?token=abc');

        $this->assertNotNull($preview);
        $this->assertTrue($preview['is_direct_video']);
        $this->assertSame('https://cdn.example.com/clips/demo.mp4?token=abc', $preview['video_url']);
        Http::assertNothingSent();
    }

    public function test_open_graph_video_url_is_playable_inline(): void
    {
        Http::fake([
            'https://example.com/watch' => Http::response(
                '<html><head>'
                .'<meta property="og:title" content="Clip">'
                .'<meta property="og:image" content="https://example.com/still.jpg">'
                .'<meta property="og:video" content="https://cdn.example.com/watch.mp4">'
                .'</head></html>',
                200
            ),
        ]);

        $preview = (new LinkPreviewService)->fetch('https://example.com/watch');

        $this->assertSame('https://cdn.example.com/watch.mp4', $preview['video_url']);
        $this->assertTrue($preview['is_direct_video']);
        $this->assertSame('https://example.com/still.jpg', $preview['image_url']);
    }

    public function test_tiktok_oembed_thumbnail_is_not_treated_as_mp4(): void
    {
        Http::fake([
            'https://www.tiktok.com/oembed*' => Http::response([
                'title' => 'A TikTok',
                'provider_name' => 'TikTok',
                'thumbnail_url' => 'https://p16.tiktokcdn.com/cover.jpeg',
            ], 200),
            'https://www.tiktok.com/@user/video/123' => Http::response('<html></html>', 200),
        ]);

        $preview = (new LinkPreviewService)->fetch('https://www.tiktok.com/@user/video/123');

        $this->assertSame('A TikTok', $preview['title']);
        $this->assertSame('https://p16.tiktokcdn.com/cover.jpeg', $preview['image_url']);
        $this->assertNull($preview['video_url']);
        $this->assertFalse($preview['is_direct_video']);
    }

    public function test_instagram_does_not_scrape_instagram_html(): void
    {
        Http::fake([
            'https://graph.facebook.com/*' => Http::response(['error' => ['message' => 'denied']], 400),
            'https://www.instagram.com/*' => Http::response('<html><head><meta property="og:title" content="should not use"></head></html>', 200),
        ]);

        $preview = (new LinkPreviewService)->fetch('https://www.instagram.com/p/abc123/');

        $this->assertSame('Instagram', $preview['source']);
        $this->assertSame('Check out my Instagram post', $preview['title']);
        $this->assertSame('View on Instagram', $preview['description']);
        $this->assertNull($preview['image_url']);
        $this->assertFalse($preview['is_direct_video']);
        Http::assertNotSent(fn ($request) => str_contains((string) parse_url($request->url(), PHP_URL_HOST), 'instagram.com'));
    }

    public function test_instagram_oembed_uses_facebook_graph_when_configured(): void
    {
        config([
            'services.facebook.app_id' => '111',
            'services.facebook.app_secret' => 'secret',
            'services.facebook.graph_version' => 'v20.0',
        ]);

        Http::fake([
            'https://graph.facebook.com/*' => Http::response([
                'title' => 'A reel',
                'author_name' => 'gazetteer',
                'thumbnail_url' => 'https://scontent.cdninstagram.com/thumb.jpg',
                'provider_name' => 'Instagram',
            ], 200),
            'https://www.instagram.com/*' => Http::response('should not scrape', 200),
        ]);

        $preview = (new LinkPreviewService)->fetch('https://www.instagram.com/reel/xyz/');

        $this->assertSame('A reel', $preview['title']);
        $this->assertSame('Instagram', $preview['source']);
        $this->assertSame('https://scontent.cdninstagram.com/thumb.jpg', $preview['image_url']);
        Http::assertNotSent(fn ($request) => str_contains((string) parse_url($request->url(), PHP_URL_HOST), 'instagram.com'));
    }

    public function test_parse_link_endpoint_returns_oembed_thumbnail_and_title(): void
    {
        config([
            'services.facebook.app_id' => '111',
            'services.facebook.app_secret' => 'secret',
            'services.facebook.graph_version' => 'v20.0',
        ]);

        Http::fake([
            'https://graph.facebook.com/*' => Http::response([
                'title' => 'Sunset reel',
                'thumbnail_url' => 'https://scontent.cdninstagram.com/cover.jpg',
                'provider_name' => 'Instagram',
            ], 200),
        ]);

        $user = User::factory()->create();
        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/parse-link?url='.urlencode('https://www.instagram.com/reel/parse1/'))
            ->assertOk()
            ->assertJsonPath('title', 'Sunset reel')
            ->assertJsonPath('thumbnail_url', 'https://scontent.cdninstagram.com/cover.jpg')
            ->assertJsonPath('image_url', 'https://scontent.cdninstagram.com/cover.jpg')
            ->assertJsonPath('source', 'Instagram');
    }

    public function test_creating_a_story_persists_link_preview_from_body(): void
    {
        Http::fake([
            'https://www.youtube.com/oembed*' => Http::response([
                'title' => 'Story clip',
                'provider_name' => 'YouTube',
                'thumbnail_url' => 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
            ], 200),
        ]);

        $user = User::factory()->create();
        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/stories', [
                'text' => 'https://www.youtube.com/watch?v=abc123',
            ])
            ->assertStatus(201);

        $this->assertSame('Story clip', $response->json('link_preview.title'));
        $this->assertSame('YouTube', $response->json('link_preview.source'));
        $this->assertSame(
            'Story clip',
            \App\Models\Story::find($response->json('id'))?->link_preview['title'] ?? null
        );
    }
}

<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Server-side boost injection into the feed.
 *
 * The contract under test:
 *  - an eligible active boost is spliced into the page at a ranked slot
 *  - eligibility is viewer-radius, not the boosted author's own location
 *  - the organic query, its order and its cursor are untouched by all of the above
 *  - every sponsored card, injected or organic, is flagged for the badge
 */
class BoostFeedInjectionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.stripe.secret' => 'sk_test_fake']);
    }

    private function seedCentroid(string $label, float $lat, float $lng): void
    {
        DB::table('location_centroids')->updateOrInsert(
            ['label' => $label],
            ['latitude' => $lat, 'longitude' => $lng]
        );
    }

    private function user(string $handle, ?string $place): User
    {
        return User::factory()->create([
            'handle' => $handle,
            'username' => $handle,
            'location_local' => $place,
            'location_regional' => $place,
            'location_national' => $place,
        ]);
    }

    /** An organic post that the location feed will naturally return. */
    private function organicPost(User $author, string $place, int $ageMinutes = 0): Post
    {
        return Post::factory()->create([
            'user_id' => $author->id,
            'location_label' => $place,
            'media_url' => 'https://example.com/o.mp4',
            'created_at' => now()->subMinutes($ageMinutes),
        ]);
    }

    /**
     * Push a promoted (old) post off page one by filling the page with newer
     * organic posts, so "is it in the page?" actually tests injection.
     */
    private function fillFeed(User $author, string $place, int $count = 25): void
    {
        for ($i = 1; $i <= $count; $i++) {
            $this->organicPost($author, $place, $i);
        }
    }

    private function boost(Post $post, User $booster, array $attrs = []): Boost
    {
        return Boost::create(array_merge([
            'post_id' => $post->id,
            'user_id' => $booster->id,
            'feed_type' => 'regional', // Dublin is a city -> regional tier
            'price' => 1.00,
            'radius_km' => 25.0,
            'center_local' => 'Dublin',
            'center_lat' => 53.3498,
            'center_lng' => -6.2603,
            'duration_hours' => 6,
            'payment_intent_id' => 'pi_'.uniqid(),
            'activated_at' => now(),
            'expires_at' => now()->addHours(6),
        ], $attrs));
    }

    private function feed(User $viewer, string $filter, array $query = []): array
    {
        return $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts?' . http_build_query(array_merge(['filter' => $filter, 'limit' => 20], $query)))
            ->assertOk()
            ->json();
    }

    // -----------------------------------------------------------------
    // Injection
    // -----------------------------------------------------------------

    public function test_eligible_boost_is_injected_into_the_page(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $viewer = $this->user('viewer_inject', 'Dublin');
        $booster = $this->user('booster_inject', 'Dublin');
        $this->organicPost($booster, 'Dublin', 5);

        // Boost a post whose author lives in Cork: the boost targets viewers in
        // Dublin, so author location must not decide eligibility.
        $corkAuthor = $this->user('author_cork', 'Cork');
        $promoted = Post::factory()->create([
            'user_id' => $corkAuthor->id,
            'location_label' => 'Cork',
            'media_url' => 'https://example.com/p.mp4',
            'created_at' => now()->subDays(3), // old, so it is not organic
        ]);
        $this->boost($promoted, $booster);
        $this->fillFeed($booster, 'Dublin');

        $items = collect($this->feed($viewer, 'Dublin')['items']);

        $this->assertTrue(
            $items->contains('id', $promoted->id),
            'a boost the viewer is inside the radius of must be injected'
        );
    }

    public function test_injected_boost_lands_at_a_ranked_slot_not_first(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $viewer = $this->user('viewer_rank', 'Dublin');
        $booster = $this->user('booster_rank', 'Dublin');
        $this->fillFeed($booster, 'Dublin');

        $promoted = Post::factory()->create([
            'user_id' => $booster->id,
            'location_label' => 'Dublin',
            'media_url' => 'https://example.com/p.mp4',
            'created_at' => now()->subDays(3),
        ]);
        $this->boost($promoted, $booster);

        $ids = collect($this->feed($viewer, 'Dublin')['items'])->pluck('id')->all();

        $this->assertContains($promoted->id, $ids);
        $this->assertNotSame(
            $promoted->id,
            $ids[0],
            'a paid slot must never occupy the very first card'
        );
        $this->assertSame(1, array_search($promoted->id, $ids, true), 'first boost belongs at index 1');
    }

    public function test_injection_respects_the_three_organic_cadence(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $viewer = $this->user('viewer_cadence', 'Dublin');
        $booster = $this->user('booster_cadence', 'Dublin');
        $this->fillFeed($booster, 'Dublin');

        $promotedIds = [];
        for ($i = 0; $i < 3; $i++) {
            $p = Post::factory()->create([
                'user_id' => $booster->id,
                'location_label' => 'Dublin',
                'media_url' => 'https://example.com/p' . $i . '.mp4',
                'created_at' => now()->subDays(3 + $i),
            ]);
            // Staggered expiry so the order is deterministic: 1st longest.
            $this->boost($p, $booster, ['expires_at' => now()->addHours(10 - $i)]);
            $promotedIds[] = $p->id;
        }

        $ids = collect($this->feed($viewer, 'Dublin')['items'])->pluck('id')->all();
        $positions = [];
        foreach ($promotedIds as $pid) {
            $positions[] = array_search($pid, $ids, true);
        }

        $this->assertSame([1, 4, 7], $positions, 'boosts should sit at slots 1, 4, 7');
    }

    public function test_longest_running_boost_is_ranked_first(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $viewer = $this->user('viewer_rank2', 'Dublin');
        $booster = $this->user('booster_rank2', 'Dublin');
        $this->fillFeed($booster, 'Dublin');

        $short = Post::factory()->create([
            'user_id' => $booster->id, 'location_label' => 'Dublin',
            'media_url' => 'https://example.com/s.mp4', 'created_at' => now()->subDays(5),
        ]);
        $long = Post::factory()->create([
            'user_id' => $booster->id, 'location_label' => 'Dublin',
            'media_url' => 'https://example.com/l.mp4', 'created_at' => now()->subDays(6),
        ]);
        $this->boost($short, $booster, ['expires_at' => now()->addHour()]);
        $this->boost($long, $booster, ['expires_at' => now()->addHours(20)]);

        $ids = collect($this->feed($viewer, 'Dublin')['items'])->pluck('id')->all();

        $this->assertLessThan(
            array_search($short->id, $ids, true),
            array_search($long->id, $ids, true),
            'the furthest-expiring boost leads'
        );
    }

    // -----------------------------------------------------------------
    // Eligibility
    // -----------------------------------------------------------------

    public function test_boost_is_withheld_from_a_viewer_outside_the_radius(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $this->seedCentroid('Cork', 51.8985, -8.4756);

        $booster = $this->user('booster_far2', 'Dublin');
        $promoted = Post::factory()->create([
            'user_id' => $booster->id, 'location_label' => 'Dublin',
            'media_url' => 'https://example.com/p.mp4', 'created_at' => now()->subDays(3),
        ]);
        $this->boost($promoted, $booster, ['radius_km' => 25.0]);

        $corkViewer = $this->user('viewer_cork2', 'Cork');
        $this->organicPost($booster, 'Cork', 1);

        $ids = collect($this->feed($corkViewer, 'Cork')['items'])->pluck('id')->all();

        $this->assertNotContains($promoted->id, $ids, 'a Dublin boost must not reach a Cork viewer');
    }

    public function test_expired_boost_is_not_injected(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $viewer = $this->user('viewer_exp2', 'Dublin');
        $booster = $this->user('booster_exp2', 'Dublin');
        $this->fillFeed($booster, 'Dublin');

        $promoted = Post::factory()->create([
            'user_id' => $booster->id, 'location_label' => 'Dublin',
            'media_url' => 'https://example.com/p.mp4', 'created_at' => now()->subDays(3),
        ]);
        $this->boost($promoted, $booster, ['expires_at' => now()->subMinute()]);

        $ids = collect($this->feed($viewer, 'Dublin')['items'])->pluck('id')->all();

        $this->assertNotContains($promoted->id, $ids);
    }

    public function test_boost_with_no_recorded_radius_is_still_shown(): void
    {
        $viewer = $this->user('viewer_norad', 'Dublin');
        $booster = $this->user('booster_norad', 'Dublin');
        $this->organicPost($booster, 'Dublin', 1);

        $promoted = Post::factory()->create([
            'user_id' => $booster->id, 'location_label' => 'Dublin',
            'media_url' => 'https://example.com/p.mp4', 'created_at' => now()->subDays(3),
        ]);
        $this->boost($promoted, $booster, ['radius_km' => null, 'center_local' => null, 'center_lat' => null, 'center_lng' => null]);

        $ids = collect($this->feed($viewer, 'Dublin')['items'])->pluck('id')->all();

        $this->assertContains($promoted->id, $ids, 'nothing to gate, so the disclosure survives');
    }

    public function test_a_post_already_on_the_page_is_not_injected_twice(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $viewer = $this->user('viewer_dup', 'Dublin');
        $booster = $this->user('booster_dup', 'Dublin');

        // Recent enough to already be organic *and* boosted.
        $post = $this->organicPost($booster, 'Dublin', 1);
        $this->boost($post, $booster);
        for ($i = 2; $i <= 6; $i++) {
            $this->organicPost($booster, 'Dublin', $i);
        }

        $ids = collect($this->feed($viewer, 'Dublin')['items'])->pluck('id')->all();

        $this->assertSame(1, count(array_keys($ids, $post->id, true)), 'no duplicate ids on a page');
        $this->assertSame(count($ids), count(array_unique($ids)));
    }

    public function test_link_share_boost_is_not_spliced_in(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $viewer = $this->user('viewer_link', 'Dublin');
        $booster = $this->user('booster_link', 'Dublin');
        $this->organicPost($booster, 'Dublin', 1);

        // A link-share card with no renderable media would be stripped by the
        // client, leaving a short page — so it must not be injected.
        $linkPost = Post::factory()->create([
            'user_id' => $booster->id,
            'location_label' => 'Dublin',
            'media_url' => null,          // the factory would otherwise add media
            'media_items' => null,
            'link_preview' => ['url' => 'https://example.com'],
            'created_at' => now()->subDays(3),
        ]);
        $this->assertFalse($linkPost->fresh()->has_renderable_media, 'fixture must be a text-only link card');
        $this->boost($linkPost, $booster);

        $ids = collect($this->feed($viewer, 'Dublin')['items'])->pluck('id')->all();

        $this->assertNotContains($linkPost->id, $ids);
    }

    // -----------------------------------------------------------------
    // Tab -> tier mapping
    // -----------------------------------------------------------------

    public function test_each_tab_pulls_only_its_own_boost_tier(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $this->seedCentroid('Ireland', 53.1424, -7.6921);

        $viewer = $this->user('viewer_tier', 'Dublin');
        $booster = $this->user('booster_tier', 'Dublin');
        $this->organicPost($booster, 'Dublin', 1);

        // Authored outside Ireland so they can never appear organically in the
        // Finglas/Dublin/Ireland feeds - only injection can put them there.
        $outsider = $this->user('author_outsider', 'London');
        $mk = function (string $tier) use ($outsider, $booster) {
            $p = Post::factory()->create([
                'user_id' => $outsider->id, 'location_label' => 'London',
                'media_url' => 'https://example.com/' . $tier . '.mp4', 'created_at' => now()->subDays(4),
            ]);
            $this->boost($p, $booster, ['feed_type' => $tier]);
            return $p->id;
        };
        $localId = $mk('local');
        $regionalId = $mk('regional');
        $nationalId = $mk('national');

        // Finglas is a neighbourhood -> local tier only.
        $finglas = collect($this->feed($viewer, 'Finglas')['items'])->pluck('id')->all();
        $this->assertContains($localId, $finglas, 'a local boost belongs on a local tab');
        $this->assertNotContains($regionalId, $finglas);
        $this->assertNotContains($nationalId, $finglas);

        // Dublin is a city -> regional tier.
        $dublin = collect($this->feed($viewer, 'Dublin')['items'])->pluck('id')->all();
        $this->assertContains($regionalId, $dublin, 'a regional boost belongs on a city tab');
        $this->assertNotContains($localId, $dublin);
        $this->assertNotContains($nationalId, $dublin);

        // Ireland is a country -> national tier.
        $ireland = collect($this->feed($viewer, 'Ireland')['items'])->pluck('id')->all();
        $this->assertContains($nationalId, $ireland, 'a national boost belongs on a country tab');
        $this->assertNotContains($localId, $ireland);
        $this->assertNotContains($regionalId, $ireland);
    }

    public function test_following_feed_pulls_every_tier(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $viewer = $this->user('viewer_follow', 'Dublin');
        $booster = $this->user('booster_follow', 'Dublin');
        DB::table('user_follows')->insert([
            'follower_id' => $viewer->id, 'following_id' => $booster->id, 'status' => 'accepted',
        ]);
        $this->organicPost($booster, 'Dublin', 1);

        $mk = function (string $tier) use ($booster) {
            $p = Post::factory()->create([
                'user_id' => $booster->id, 'location_label' => 'Dublin',
                'media_url' => 'https://example.com/f' . $tier . '.mp4', 'created_at' => now()->subDays(4),
            ]);
            $this->boost($p, $booster, ['feed_type' => $tier]);
            return $p->id;
        };
        $tiers = [$mk('local'), $mk('regional'), $mk('national')];

        $ids = collect($this->feed($viewer, 'Following')['items'])->pluck('id')->all();

        foreach ($tiers as $t) {
            $this->assertContains($t, $ids, 'Following should see every tier');
        }
    }

    public function test_guest_gets_no_boost_injection(): void
    {
        $booster = $this->user('booster_guest', 'Dublin');
        $promoted = Post::factory()->create([
            'user_id' => $booster->id, 'location_label' => 'Dublin',
            'media_url' => 'https://example.com/p.mp4', 'created_at' => now()->subDays(3),
        ]);
        $this->boost($promoted, $booster);
        $this->fillFeed($booster, 'Dublin');

        $res = $this->getJson('/api/posts?filter=Dublin&limit=20')->assertOk();
        $ids = collect($res->json('items'))->pluck('id')->all();

        $this->assertNotContains($promoted->id, $ids, 'no viewer means no radius to target');
    }

    // -----------------------------------------------------------------
    // Sponsored badge
    // -----------------------------------------------------------------

    public function test_injected_post_is_flagged_for_the_badge(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $viewer = $this->user('viewer_badge', 'Dublin');
        $booster = $this->user('booster_badge', 'Dublin');
        $this->organicPost($booster, 'Dublin', 5);

        $promoted = Post::factory()->create([
            'user_id' => $booster->id, 'location_label' => 'Dublin',
            'media_url' => 'https://example.com/p.mp4', 'created_at' => now()->subDays(3),
        ]);
        $this->boost($promoted, $booster, ['feed_type' => 'regional']);
        $this->fillFeed($booster, 'Dublin');

        $items = collect($this->feed($viewer, 'Dublin')['items'])->keyBy('id');

        $this->assertTrue($items[$promoted->id]['isBoosted'], 'injected card must be flagged');
        $this->assertSame('regional', $items[$promoted->id]['boostFeedType']);
    }

    public function test_boosted_post_surfacing_organically_is_still_flagged_on_later_pages(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $viewer = $this->user('viewer_badge2', 'Dublin');
        $booster = $this->user('booster_badge2', 'Dublin');

        // Oldest of 13, so at limit 10 it only appears on page 2.
        for ($i = 1; $i <= 12; $i++) {
            $this->organicPost($booster, 'Dublin', $i);
        }
        $older = $this->organicPost($booster, 'Dublin', 13);
        // 'national' is not injected on a Dublin (regional) tab, so this post can
        // only ever reach the feed organically - the disclosure path under test.
        $this->boost($older, $booster, ['feed_type' => 'national']);

        $page1 = $this->feed($viewer, 'Dublin', ['limit' => 10]);
        $this->assertNotContains($older->id, collect($page1['items'])->pluck('id')->all());

        $page2 = $this->feed($viewer, 'Dublin', ['limit' => 10, 'cursor' => $page1['nextCursor']]);
        $items = collect($page2['items'])->keyBy('id');

        $this->assertTrue(
            $items[$older->id]['isBoosted'],
            'disclosure is a legal duty, so it rides along on any page the post appears on'
        );
    }

    // -----------------------------------------------------------------
    // Cursor integrity + query cost
    // -----------------------------------------------------------------

    public function test_paging_with_a_boost_active_neither_skips_nor_repeats_organic_posts(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $viewer = $this->user('viewer_page', 'Dublin');
        $booster = $this->user('booster_page', 'Dublin');

        $organicIds = [];
        for ($i = 1; $i <= 30; $i++) {
            $organicIds[] = $this->organicPost($booster, 'Dublin', $i)->id;
        }

        $promoted = Post::factory()->create([
            'user_id' => $booster->id, 'location_label' => 'Dublin',
            'media_url' => 'https://example.com/p.mp4', 'created_at' => now()->subDays(3),
        ]);
        $this->boost($promoted, $booster);

        $seen = [];
        $cursor = null;
        for ($page = 0; $page < 4; $page++) {
            $res = $this->feed($viewer, 'Dublin', array_filter(['limit' => 10, 'cursor' => $cursor]));
            foreach ($res['items'] as $item) {
                $id = (string) $item['id'];
                if ($id !== (string) $promoted->id) {
                    $seen[] = $id;
                }
            }
            $cursor = $res['nextCursor'];
            if (!$cursor) {
                break;
            }
        }

        $this->assertSame(count($seen), count(array_unique($seen)), 'organic posts must not repeat across pages');
        $this->assertSame($organicIds, $seen, 'every organic post exactly once, in order, none skipped');
    }

    public function test_boost_is_only_injected_on_the_first_page(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $viewer = $this->user('viewer_first', 'Dublin');
        $booster = $this->user('booster_first', 'Dublin');
        for ($i = 1; $i <= 25; $i++) {
            $this->organicPost($booster, 'Dublin', $i);
        }
        $promoted = Post::factory()->create([
            'user_id' => $booster->id, 'location_label' => 'Dublin',
            'media_url' => 'https://example.com/p.mp4', 'created_at' => now()->subDays(3),
        ]);
        $this->boost($promoted, $booster);

        $page1 = $this->feed($viewer, 'Dublin', ['limit' => 10]);
        $this->assertContains($promoted->id, collect($page1['items'])->pluck('id')->all());

        $page2 = $this->feed($viewer, 'Dublin', ['limit' => 10, 'cursor' => $page1['nextCursor']]);
        $this->assertNotContains(
            $promoted->id,
            collect($page2['items'])->pluck('id')->all(),
            'inventory is spent once, not on every page of the scroll'
        );
    }

    public function test_injection_adds_a_bounded_number_of_queries(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $viewer = $this->user('viewer_q', 'Dublin');
        $booster = $this->user('booster_q', 'Dublin');
        for ($i = 1; $i <= 8; $i++) {
            $this->organicPost($booster, 'Dublin', $i);
        }
        for ($i = 0; $i < 6; $i++) {
            $p = Post::factory()->create([
                'user_id' => $booster->id, 'location_label' => 'Dublin',
                'media_url' => 'https://example.com/q' . $i . '.mp4', 'created_at' => now()->subDays(4),
            ]);
            $this->boost($p, $booster);
        }

        $queries = [];
        DB::listen(function ($q) use (&$queries) {
            $queries[] = $q->sql;
        });

        $this->feed($viewer, 'Dublin', ['limit' => 16]);

        $boostQueries = array_values(array_filter($queries, fn ($sql) =>
            str_contains($sql, 'from "boosts"') || str_contains($sql, 'from `boosts`')
        ));
        $this->assertLessThanOrEqual(
            2,
            count($boostQueries),
            'boost reads must be one scan + one batched hydrate, not per-post: ' . count($boostQueries)
        );
    }

    /**
     * The candidate scan must ride the (feed_type, expires_at) index.
     *
     * Guards the "no query stalls" requirement: a single-tier tab has to filter
     * and sort on the index. If this ever regresses to a scan or a temp B-tree
     * sort, feed latency creeps up on exactly the queries we cannot afford to
     * slow down.
     */
    public function test_candidate_scan_uses_the_feed_type_expires_index(): void
    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $viewer = $this->user('viewer_plan', 'Dublin');
        $booster = $this->user('booster_plan', 'Dublin');
        $this->organicPost($booster, 'Dublin', 1);

        $queries = [];
        DB::listen(function ($q) use (&$queries) {
            $queries[] = $q->sql;
        });

        $this->feed($viewer, 'Dublin', ['limit' => 16]);

        $scan = null;
        foreach ($queries as $sql) {
            $lower = strtolower($sql);
            // The candidate scan is the boosts read that filters on feed_type and
            // is bounded. (activeBoostMap is a different read: it keys off post_id
            // to label the page, and is not the query this test is about.)
            if (
                str_contains($lower, 'from "boosts"')
                && str_contains($lower, 'limit')
                && str_contains($lower, 'feed_type')
                && !str_contains($lower, '"post_id" in')
            ) {
                $scan = $sql;
            }
        }
        $this->assertNotNull($scan, 'expected a boost candidate scan');
        $this->assertStringContainsString('"feed_type" = ?', $scan, 'single tier should use equality, not IN()');
        $this->assertStringNotContainsString('in (', strtolower($scan), 'IN() forces a temp sort');

        $plan = DB::select('EXPLAIN QUERY PLAN ' . $scan, ['now']);
        $detail = strtolower(implode(' ', array_map(fn ($r) => $r->detail, $plan)));
        $this->assertStringContainsString('boosts_feed_type_expires_at_index', $detail);
        $this->assertStringNotContainsString('scan boosts', $detail, 'must not full-scan boosts');
        $this->assertStringNotContainsString('temp b-tree', $detail, 'must not buffer a sort');
    }

    public function test_injection_does_not_join_or_order_the_organic_query(): void    {
        $this->seedCentroid('Dublin', 53.3498, -6.2603);
        $viewer = $this->user('viewer_sql', 'Dublin');
        $booster = $this->user('booster_sql', 'Dublin');
        $this->organicPost($booster, 'Dublin', 1);
        $p = Post::factory()->create([
            'user_id' => $booster->id, 'location_label' => 'Dublin',
            'media_url' => 'https://example.com/p.mp4', 'created_at' => now()->subDays(3),
        ]);
        $this->boost($p, $booster);

        $queries = [];
        DB::listen(function ($q) use (&$queries) {
            $queries[] = $q->sql;
        });

        $this->feed($viewer, 'Dublin', ['limit' => 16]);

        $organicSql = '';
        foreach ($queries as $sql) {
            if (str_contains($sql, 'from "posts"') && str_contains($sql, 'order by')) {
                $organicSql = $sql;
            }
        }

        $this->assertNotSame('', $organicSql, 'expected to capture the organic query');
        $this->assertStringNotContainsStringIgnoringCase('join "boosts"', $organicSql);
        $this->assertStringNotContainsStringIgnoringCase('join `boosts`', $organicSql);
        $this->assertStringNotContainsStringIgnoringCase('boost_rank', $organicSql);
    }
}

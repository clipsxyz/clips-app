<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class LocationFeedRankingTest extends TestCase
{
    use RefreshDatabase;

    private function placeUser(string $local, string $regional = 'Rankshire', string $national = 'Ireland'): User
    {
        return User::factory()->create([
            'location_local' => $local,
            'location_regional' => $regional,
            'location_national' => $national,
        ]);
    }

    public function test_location_feed_ranks_unseen_local_posts_and_keeps_seen_ones(): void
    {
        $viewer = $this->placeUser('Rankville');
        $author = $this->placeUser('Rankville');
        $elsewhere = $this->placeUser('Otherport', 'Otherregion', 'France');

        $unseen = Post::factory()->forUser($author)->create([
            'likes_count' => 8,
            'created_at' => now()->subHours(6),
        ]);
        $seen = Post::factory()->forUser($author)->create([
            'likes_count' => 8,
            'created_at' => now()->subHours(6),
        ]);
        Post::factory()->forUser($elsewhere)->create([
            'likes_count' => 500,
            'created_at' => now()->subHour(),
        ]);
        DB::table('post_views')->insert([
            'user_id' => $viewer->id,
            'post_id' => $seen->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts?filter=Rankville&limit=10');

        $response->assertOk();
        $ids = collect($response->json('items'))->pluck('id')->all();
        $this->assertSame([$unseen->id, $seen->id], $ids);
    }

    public function test_followed_author_is_nudged_above_an_equal_local_post(): void
    {
        $viewer = $this->placeUser('Rankville');
        $followed = $this->placeUser('Rankville');
        $other = $this->placeUser('Rankville');
        $viewer->following()->attach($followed->id, ['status' => 'accepted']);

        $fromFollowed = Post::factory()->forUser($followed)->create([
            'likes_count' => 3,
            'created_at' => now()->subHours(4),
        ]);
        $fromOther = Post::factory()->forUser($other)->create([
            'likes_count' => 3,
            'created_at' => now()->subHours(4),
        ]);

        $ids = collect(
            $this->actingAs($viewer, 'sanctum')->getJson('/api/posts?filter=Rankville&limit=10')->json('items')
        )->pluck('id')->all();

        $this->assertSame([$fromFollowed->id, $fromOther->id], $ids);
    }

    public function test_following_feed_stays_on_followed_accounts(): void
    {
        $viewer = $this->placeUser('Rankville');
        $followed = $this->placeUser('Faraway', 'Farshire', 'Spain');
        $stranger = $this->placeUser('Rankville');
        $viewer->following()->attach($followed->id, ['status' => 'accepted']);

        $kept = Post::factory()->forUser($followed)->create(['created_at' => now()->subHour()]);
        Post::factory()->forUser($stranger)->create([
            'likes_count' => 100,
            'created_at' => now()->subMinutes(5),
        ]);

        $ids = collect(
            $this->actingAs($viewer, 'sanctum')->getJson('/api/posts?filter=Following&limit=10')->json('items')
        )->pluck('id')->all();

        $this->assertSame([$kept->id], $ids);
    }

    public function test_active_boost_ranks_above_an_equal_post(): void
    {
        $viewer = $this->placeUser('Rankville');
        $author = $this->placeUser('Rankville');
        $plain = Post::factory()->forUser($author)->create([
            'likes_count' => 4,
            'created_at' => now()->subHours(3),
        ]);
        $boosted = Post::factory()->forUser($author)->create([
            'likes_count' => 4,
            'created_at' => now()->subHours(3),
            'is_boosted' => true,
            'boosted_until' => now()->addDay(),
        ]);

        $ids = collect(
            $this->actingAs($viewer, 'sanctum')->getJson('/api/posts?filter=Rankville&limit=10')->json('items')
        )->pluck('id')->all();

        $this->assertSame([$boosted->id, $plain->id], $ids);
    }

    public function test_ranked_pages_do_not_repeat_posts(): void
    {
        $viewer = $this->placeUser('Rankville');
        $author = $this->placeUser('Rankville');
        foreach ([1, 5, 12] as $likes) {
            Post::factory()->forUser($author)->create([
                'likes_count' => $likes,
                'created_at' => now()->subHours(2),
            ]);
        }

        $seen = [];
        $cursor = null;
        for ($page = 0; $page < 4; $page++) {
            $url = '/api/posts?filter=Rankville&limit=1'.($cursor ? '&cursor='.urlencode($cursor) : '');
            $response = $this->actingAs($viewer, 'sanctum')->getJson($url);
            $response->assertOk();
            $ids = collect($response->json('items'))->pluck('id')->all();
            $this->assertCount($page < 3 ? 1 : 0, $ids);
            foreach ($ids as $id) {
                $this->assertNotContains($id, $seen);
                $seen[] = $id;
            }
            $cursor = $response->json('nextCursor');
            if ($cursor === null) {
                break;
            }
        }

        $this->assertCount(3, $seen);
    }

    public function test_mark_seen_records_each_post_once(): void
    {
        $viewer = $this->placeUser('Rankville');
        $post = Post::factory()->forUser($viewer)->create();

        $this->postJson('/api/posts/mark-seen', ['post_ids' => [$post->id]])->assertUnauthorized();

        $this->actingAs($viewer, 'sanctum')
            ->postJson('/api/posts/mark-seen', ['post_ids' => [$post->id, $post->id]])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->actingAs($viewer, 'sanctum')
            ->postJson('/api/posts/mark-seen', ['post_ids' => [$post->id]])
            ->assertOk();

        $this->assertSame(1, DB::table('post_views')->where('user_id', $viewer->id)->where('post_id', $post->id)->count());
    }

    public function test_following_feed_collapses_reclips_of_the_same_post(): void
    {
        $viewer = $this->placeUser('Rankville');
        $author = $this->placeUser('Elsewhere', 'Farshire', 'Spain');
        $ada = $this->placeUser('Rankville');
        $ada->handle = '@Ada';
        $ada->save();
        $ben = $this->placeUser('Rankville');
        $ben->handle = '@Ben';
        $ben->save();
        $cara = $this->placeUser('Rankville');
        $cara->handle = '@Cara';
        $cara->save();
        foreach ([$ada, $ben, $cara] as $followed) {
            $viewer->following()->attach($followed->id, ['status' => 'accepted']);
        }

        $original = Post::factory()->forUser($author)->create([
            'created_at' => now()->subDays(2),
        ]);
        $this->reclipBy($ada, $original, now()->subHours(5));
        $middle = $this->reclipBy($ben, $original, now()->subHours(3));
        $newest = $this->reclipBy($cara, $original, now()->subHours(1));
        $other = Post::factory()->forUser($ada)->create([
            'created_at' => now()->subHours(2),
        ]);

        $first = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts?filter=Following&limit=1');
        $first->assertOk();
        $second = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/posts?filter=Following&limit=1&cursor='.urlencode((string) $first->json('nextCursor')));
        $second->assertOk();

        $ids = [
            ...collect($first->json('items'))->pluck('id')->all(),
            ...collect($second->json('items'))->pluck('id')->all(),
        ];
        $this->assertSame([$newest->id, $other->id], $ids);
        $this->assertNotContains($middle->id, $ids);
        $this->assertSame(['Cara', 'Ben', 'Ada'], $first->json('items.0.reclip_attribution_handles'));
        $this->assertNull($second->json('items.0.reclip_attribution_handles'));
    }

    public function test_a_seen_reclip_copy_counts_as_seen_for_the_collapsed_card(): void
    {
        $viewer = $this->placeUser('Rankville');
        $author = $this->placeUser('Elsewhere', 'Farshire', 'Spain');
        $ada = $this->placeUser('Rankville');
        $ben = $this->placeUser('Rankville');
        $controlAuthor = $this->placeUser('Rankville');
        foreach ([$ada, $ben, $controlAuthor] as $followed) {
            $viewer->following()->attach($followed->id, ['status' => 'accepted']);
        }

        $when = now()->subHours(4);
        $original = Post::factory()->forUser($author)->create(['created_at' => now()->subDays(3)]);
        $seenCopy = $this->reclipBy($ada, $original, $when->copy()->subHour());
        $survivor = $this->reclipBy($ben, $original, $when->copy());
        $survivor->likes_count = 4;
        $survivor->save();
        $control = Post::factory()->forUser($controlAuthor)->create([
            'likes_count' => 4,
            'created_at' => $when->copy(),
        ]);
        DB::table('post_views')->insert([
            'user_id' => $viewer->id,
            'post_id' => $seenCopy->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $ids = collect(
            $this->actingAs($viewer, 'sanctum')->getJson('/api/posts?filter=Following&limit=10')->json('items')
        )->pluck('id')->all();

        $this->assertSame([$control->id, $survivor->id], $ids);
    }

    public function test_location_feed_still_ignores_reclip_copies(): void
    {
        $viewer = $this->placeUser('Rankville');
        $author = $this->placeUser('Rankville');
        $reclipper = $this->placeUser('Rankville');
        $viewer->following()->attach($reclipper->id, ['status' => 'accepted']);

        $original = Post::factory()->forUser($author)->create([
            'likes_count' => 2,
            'created_at' => now()->subHours(3),
        ]);
        $this->reclipBy($reclipper, $original, now()->subHour());

        $ids = collect(
            $this->actingAs($viewer, 'sanctum')->getJson('/api/posts?filter=Rankville&limit=10')->json('items')
        )->pluck('id')->all();

        $this->assertSame([$original->id], $ids);
    }

    private function reclipBy(User $user, Post $original, \Carbon\Carbon $when): Post
    {
        return Post::factory()->forUser($user)->create([
            'is_reclipped' => true,
            'original_post_id' => $original->id,
            'original_user_handle' => $original->user_handle,
            'reclipped_by' => $user->handle,
            'text_content' => $original->text_content,
            'likes_count' => 1,
            'created_at' => $when,
        ]);
    }
}

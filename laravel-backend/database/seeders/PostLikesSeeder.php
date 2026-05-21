<?php

namespace Database\Seeders;

use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Populates post_likes pivot rows so GET /api/posts/{id}/likes returns real likers.
 * Run after GazetteerSeeder (which sets likes_count on posts but not pivot rows).
 */
class PostLikesSeeder extends Seeder
{
    public function run(): void
    {
        $users = User::all();
        if ($users->isEmpty()) {
            $this->command?->warn('PostLikesSeeder: no users — run GazetteerSeeder first.');
            return;
        }

        $posts = Post::where('likes_count', '>', 0)->get();
        foreach ($posts as $post) {
            $target = min((int) $post->likes_count, $users->count());
            $likers = $users
                ->where('id', '!=', $post->user_id)
                ->shuffle()
                ->take($target);

            foreach ($likers as $liker) {
                if (!$liker->postLikes()->where('post_id', $post->id)->exists()) {
                    $liker->postLikes()->attach($post->id);
                }
            }

            $actual = $post->likes()->count();
            if ($actual !== (int) $post->likes_count) {
                $post->update(['likes_count' => $actual]);
            }
        }

        $this->command?->info('PostLikesSeeder: synced post_likes for ' . $posts->count() . ' posts.');
    }
}

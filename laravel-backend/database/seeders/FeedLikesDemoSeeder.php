<?php

namespace Database\Seeders;

use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Minimal feed + likes demo data for local API testing (likes sheet, tagged badge).
 * Safe to run multiple times (uses firstOrCreate).
 */
class FeedLikesDemoSeeder extends Seeder
{
    public function run(): void
    {
        $accounts = [
            [
                'email' => 'darragh@example.com',
                'username' => 'darraghdublin',
                'handle' => 'darraghdublin',
                'display_name' => 'Darragh',
            ],
            [
                'email' => 'alice@example.com',
                'username' => 'alice_dublin',
                'handle' => 'alice@dublin',
                'display_name' => 'Alice',
            ],
            [
                'email' => 'bob@example.com',
                'username' => 'bob_finglas',
                'handle' => 'bob@finglas',
                'display_name' => 'Bob',
            ],
            [
                'email' => 'charlie@example.com',
                'username' => 'charlie_ireland',
                'handle' => 'charlie@ireland',
                'display_name' => 'Charlie',
            ],
            [
                'email' => 'ava.galway@example.com',
                'username' => 'ava_galway',
                'handle' => 'Ava@galway',
                'display_name' => 'Ava',
            ],
        ];

        $users = [];
        foreach ($accounts as $row) {
            $users[$row['handle']] = User::firstOrCreate(
                ['email' => $row['email']],
                [
                    'username' => $row['username'],
                    'password' => Hash::make('password123'),
                    'display_name' => $row['display_name'],
                    'handle' => $row['handle'],
                    'location_local' => 'Dublin',
                    'location_regional' => 'Dublin',
                    'location_national' => 'Ireland',
                ]
            );
        }

        $alice = $users['alice@dublin'];
        $bob = $users['bob@finglas'];
        $charlie = $users['charlie@ireland'];
        $ava = $users['Ava@galway'];
        $darragh = $users['darraghdublin'];

        // Viewer follows Bob (for follow button state in likes sheet)
        if (!$darragh->isFollowing($bob)) {
            $bob->followers()->attach($darragh->id, ['status' => 'accepted']);
        }

        $demoPosts = [
            [
                'user' => $alice,
                'text' => 'Beautiful sunset at Phoenix Park today!',
                'location' => 'Phoenix Park, Dublin',
                'likes' => [$bob, $charlie, $ava, $darragh],
                'tagged' => [$bob, $charlie],
                'views' => 120,
            ],
            [
                'user' => $bob,
                'text' => 'Amazing brunch at The Fumbally!',
                'location' => 'The Fumbally, Dublin',
                'likes' => [$alice, $charlie, $darragh],
                'tagged' => [],
                'views' => 85,
            ],
            [
                'user' => $charlie,
                'text' => 'Exploring Cork — great day for a walk.',
                'location' => 'Cork City',
                'likes' => [$alice, $bob, $ava],
                'tagged' => [$alice],
                'views' => 95,
            ],
        ];

        foreach ($demoPosts as $spec) {
            $author = $spec['user'];
            $post = Post::firstOrCreate(
                [
                    'user_id' => $author->id,
                    'text_content' => $spec['text'],
                ],
                [
                    'user_handle' => $author->handle,
                    'location_label' => $spec['location'],
                    'likes_count' => count($spec['likes']),
                    'views_count' => $spec['views'],
                    'comments_count' => 0,
                ]
            );

            foreach ($spec['likes'] as $liker) {
                if ($liker->id !== $author->id && !$liker->postLikes()->where('post_id', $post->id)->exists()) {
                    $liker->postLikes()->attach($post->id);
                }
            }

            $post->update(['likes_count' => $post->likes()->count()]);

            if ($spec['tagged'] !== []) {
                $post->attachTaggedUsersPivot(
                    collect($spec['tagged'])->mapWithKeys(
                        fn ($tagged) => [$tagged->id => $tagged->handle]
                    )->all()
                );
            }
        }

        $this->command?->info('FeedLikesDemoSeeder: demo posts and post_likes ready.');
        $this->command?->info('Login: darragh@example.com / password123');
    }
}

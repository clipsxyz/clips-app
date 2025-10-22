<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Post;
use App\Models\Comment;
use Illuminate\Support\Facades\Hash;

class GazetteerSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create sample users
        $users = [
            [
                'username' => 'darraghdublin',
                'email' => 'darragh@example.com',
                'password' => Hash::make('password123'),
                'display_name' => 'Darragh',
                'handle' => 'darraghdublin',
                'location_local' => 'Finglas',
                'location_regional' => 'Dublin',
                'location_national' => 'Ireland',
            ],
            [
                'username' => 'alice_dublin',
                'email' => 'alice@example.com',
                'password' => Hash::make('password123'),
                'display_name' => 'Alice',
                'handle' => 'alice@dublin',
                'location_local' => 'Dublin City',
                'location_regional' => 'Dublin',
                'location_national' => 'Ireland',
            ],
            [
                'username' => 'bob_finglas',
                'email' => 'bob@example.com',
                'password' => Hash::make('password123'),
                'display_name' => 'Bob',
                'handle' => 'bob@finglas',
                'location_local' => 'Finglas',
                'location_regional' => 'Dublin',
                'location_national' => 'Ireland',
            ],
            [
                'username' => 'charlie_ireland',
                'email' => 'charlie@example.com',
                'password' => Hash::make('password123'),
                'display_name' => 'Charlie',
                'handle' => 'charlie@ireland',
                'location_local' => 'Cork',
                'location_regional' => 'Cork',
                'location_national' => 'Ireland',
            ],
        ];

        foreach ($users as $userData) {
            User::create($userData);
        }

        // Create sample posts
        $alice = User::where('handle', 'alice@dublin')->first();
        $bob = User::where('handle', 'bob@finglas')->first();
        $charlie = User::where('handle', 'charlie@ireland')->first();

        $posts = [
            [
                'user_id' => $alice->id,
                'user_handle' => $alice->handle,
                'text_content' => 'Beautiful sunset at Phoenix Park today! 🌅',
                'location_label' => 'Phoenix Park, Dublin',
                'likes_count' => 15,
                'views_count' => 120,
                'comments_count' => 3,
            ],
            [
                'user_id' => $bob->id,
                'user_handle' => $bob->handle,
                'text_content' => 'Amazing brunch at The Fumbally! 🥞',
                'location_label' => 'The Fumbally, Dublin',
                'likes_count' => 8,
                'views_count' => 85,
                'comments_count' => 2,
            ],
            [
                'user_id' => $charlie->id,
                'user_handle' => $charlie->handle,
                'text_content' => 'Exploring the beautiful streets of Cork today',
                'location_label' => 'Cork City',
                'likes_count' => 12,
                'views_count' => 95,
                'comments_count' => 1,
            ],
        ];

        foreach ($posts as $postData) {
            Post::create($postData);
        }

        // Create sample comments with replies
        $phoenixPost = Post::where('text_content', 'LIKE', '%Phoenix Park%')->first();
        $fumballyPost = Post::where('text_content', 'LIKE', '%Fumbally%')->first();

        // Comments
        $comment1 = Comment::create([
            'post_id' => $phoenixPost->id,
            'user_id' => $alice->id,
            'user_handle' => $alice->handle,
            'text_content' => 'This looks amazing! Where is this taken?',
            'likes_count' => 3,
            'replies_count' => 2,
        ]);

        $comment2 = Comment::create([
            'post_id' => $phoenixPost->id,
            'user_id' => $bob->id,
            'user_handle' => $bob->handle,
            'text_content' => 'Great shot! 📸',
            'likes_count' => 1,
            'replies_count' => 0,
        ]);

        $comment3 = Comment::create([
            'post_id' => $fumballyPost->id,
            'user_id' => $charlie->id,
            'user_handle' => $charlie->handle,
            'text_content' => 'That brunch looks delicious! What cafe is this?',
            'likes_count' => 0,
            'replies_count' => 1,
        ]);

        // Replies
        Comment::create([
            'post_id' => $phoenixPost->id,
            'user_id' => $bob->id,
            'user_handle' => $bob->handle,
            'text_content' => 'It\'s at Phoenix Park! Great spot for photos.',
            'parent_id' => $comment1->id,
            'likes_count' => 1,
        ]);

        Comment::create([
            'post_id' => $phoenixPost->id,
            'user_id' => $charlie->id,
            'user_handle' => $charlie->handle,
            'text_content' => 'I was there last week, beautiful place!',
            'parent_id' => $comment1->id,
            'likes_count' => 0,
        ]);

        Comment::create([
            'post_id' => $fumballyPost->id,
            'user_id' => $alice->id,
            'user_handle' => $alice->handle,
            'text_content' => 'It\'s The Fumbally! Best brunch in Dublin.',
            'parent_id' => $comment3->id,
            'likes_count' => 2,
        ]);

        // Update user posts count
        $alice->increment('posts_count');
        $bob->increment('posts_count');
        $charlie->increment('posts_count');
    }
}

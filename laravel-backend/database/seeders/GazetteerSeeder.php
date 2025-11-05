<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Post;
use App\Models\Comment;
use App\Models\Notification;
use App\Models\Message;
use App\Models\Story;
use App\Models\StoryReaction;
use App\Models\StoryReply;
use App\Models\StoryView;
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

        // Create sample notifications
        Notification::create([
            'user_id' => $alice->id,
            'type' => 'like',
            'from_handle' => $bob->handle,
            'to_handle' => $alice->handle,
            'post_id' => $phoenixPost->id,
            'message' => 'liked your post',
            'read' => false,
        ]);

        Notification::create([
            'user_id' => $bob->id,
            'type' => 'comment',
            'from_handle' => $charlie->handle,
            'to_handle' => $bob->handle,
            'post_id' => $fumballyPost->id,
            'comment_id' => $comment3->id,
            'message' => 'commented on your post',
            'read' => false,
        ]);

        Notification::create([
            'user_id' => $alice->id,
            'type' => 'follow',
            'from_handle' => $bob->handle,
            'to_handle' => $alice->handle,
            'message' => 'started following you',
            'read' => true,
        ]);

        // Create sample messages/conversations
        $darragh = User::where('handle', 'darraghdublin')->first();
        
        // Conversation between Alice and Bob
        $conversationId1 = Message::getConversationId($alice->handle, $bob->handle);
        
        Message::create([
            'conversation_id' => $conversationId1,
            'sender_handle' => $alice->handle,
            'recipient_handle' => $bob->handle,
            'text' => 'Hey Bob! Great to see your post about The Fumbally!',
            'is_system_message' => false,
        ]);

        Message::create([
            'conversation_id' => $conversationId1,
            'sender_handle' => $bob->handle,
            'recipient_handle' => $alice->handle,
            'text' => 'Thanks Alice! 😊 You should definitely check it out!',
            'is_system_message' => false,
        ]);

        // Conversation between Darragh and Alice
        $conversationId2 = Message::getConversationId($darragh->handle, $alice->handle);
        
        Message::create([
            'conversation_id' => $conversationId2,
            'sender_handle' => $darragh->handle,
            'recipient_handle' => $alice->handle,
            'text' => '🎉',
            'is_system_message' => false,
        ]);

        // Create sample stories
        $story1 = Story::create([
            'user_id' => $alice->id,
            'user_handle' => $alice->handle,
            'media_url' => 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=800',
            'media_type' => 'image',
            'text' => 'Amazing sunset in Dublin! 🌅',
            'text_color' => '#FFFFFF',
            'text_size' => 'medium',
            'location' => 'Dublin',
            'views_count' => 5,
            'expires_at' => now()->addHours(24),
        ]);

        $story2 = Story::create([
            'user_id' => $bob->id,
            'user_handle' => $bob->handle,
            'media_url' => 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
            'media_type' => 'image',
            'text' => 'Beautiful day for a walk! 🚶',
            'text_color' => '#000000',
            'text_size' => 'small',
            'location' => 'Finglas',
            'views_count' => 3,
            'expires_at' => now()->addHours(24),
        ]);

        // Create story reactions
        StoryReaction::create([
            'story_id' => $story1->id,
            'user_id' => $bob->id,
            'user_handle' => $bob->handle,
            'emoji' => '❤️',
        ]);

        StoryReaction::create([
            'story_id' => $story1->id,
            'user_id' => $charlie->id,
            'user_handle' => $charlie->handle,
            'emoji' => '🔥',
        ]);

        // Create story replies
        StoryReply::create([
            'story_id' => $story1->id,
            'user_id' => $bob->id,
            'user_handle' => $bob->handle,
            'text' => 'Beautiful shot! Where is this?',
        ]);

        // Create story views
        StoryView::create([
            'story_id' => $story1->id,
            'user_id' => $bob->id,
        ]);

        StoryView::create([
            'story_id' => $story1->id,
            'user_id' => $charlie->id,
        ]);

        StoryView::create([
            'story_id' => $story2->id,
            'user_id' => $alice->id,
        ]);
    }
}

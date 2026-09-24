<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\BoostAnalyticsEvent;
use App\Models\Message;
use App\Models\Post;
use App\Models\User;
use App\Services\BoostAnalyticsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoostAnalyticsServiceTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $handle): User
    {
        return User::factory()->create(['handle' => $handle]);
    }

    private function postFor(User $user): Post
    {
        return Post::factory()->create([
            'user_id' => $user->id,
            'user_handle' => $user->handle,
        ]);
    }

    private function activeBoost(Post $post, User $user): Boost
    {
        return Boost::create([
            'post_id' => $post->id,
            'user_id' => $user->id,
            'feed_type' => 'local',
            'price' => 4.99,
            'activated_at' => now()->subHours(1),
            'expires_at' => now()->addDays(1),
        ]);
    }

    public function test_increment_for_post_rejects_non_positive_by(): void
    {
        $this->assertFalse(BoostAnalyticsService::incrementForPost('post-1', 'impressions_count', 0));
        $this->assertFalse(BoostAnalyticsService::incrementForPost('post-1', 'impressions_count', -3));
    }

    public function test_increment_for_post_rejects_unknown_metric(): void
    {
        $this->assertFalse(BoostAnalyticsService::incrementForPost('post-1', 'views_count'));
    }

    public function test_increment_for_post_returns_false_without_active_boost(): void
    {
        $user = $this->user('@owner');
        $post = $this->postFor($user);

        $this->assertFalse(BoostAnalyticsService::incrementForPost($post->id, 'impressions_count'));
    }

    public function test_increment_for_post_ignores_expired_boost(): void
    {
        $user = $this->user('@owner');
        $post = $this->postFor($user);
        Boost::create([
            'post_id' => $post->id,
            'user_id' => $user->id,
            'feed_type' => 'local',
            'price' => 4.99,
            'activated_at' => now()->subDays(3),
            'expires_at' => now()->subDay(),
        ]);

        $this->assertFalse(BoostAnalyticsService::incrementForPost($post->id, 'impressions_count'));
    }

    public function test_increment_for_post_increments_counter_and_records_events(): void
    {
        $user = $this->user('@owner');
        $post = $this->postFor($user);
        $boost = $this->activeBoost($post, $user);

        $this->assertTrue(BoostAnalyticsService::incrementForPost($post->id, 'impressions_count', 3));

        $this->assertSame(3, $boost->fresh()->impressions_count);
        $this->assertNotNull($boost->fresh()->last_analytics_event_at);
        $this->assertSame(3, BoostAnalyticsEvent::where('boost_id', $boost->id)->where('event_type', 'impression')->count());
        $this->assertSame(
            'counter_increment',
            BoostAnalyticsEvent::where('boost_id', $boost->id)->value('attribution_context')
        );
    }

    public function test_record_profile_visit_rejects_self_visit(): void
    {
        $owner = $this->user('@owner');
        $post = $this->postFor($owner);
        $this->activeBoost($post, $owner);

        $this->assertFalse(BoostAnalyticsService::recordProfileVisitForUser($owner->id, $owner->id, $post->id));
    }

    public function test_record_profile_visit_returns_false_without_boost(): void
    {
        $owner = $this->user('@owner');
        $actor = $this->user('@actor');

        $this->assertFalse(BoostAnalyticsService::recordProfileVisitForUser($owner->id, $actor->id));
    }

    public function test_record_profile_visit_uses_source_post_context(): void
    {
        $owner = $this->user('@owner');
        $actor = $this->user('@actor');
        $post = $this->postFor($owner);
        $boost = $this->activeBoost($post, $owner);

        $this->assertTrue(BoostAnalyticsService::recordProfileVisitForUser($owner->id, $actor->id, $post->id));

        $event = BoostAnalyticsEvent::where('boost_id', $boost->id)->where('event_type', 'profile_visit')->firstOrFail();
        $this->assertSame($actor->id, $event->actor_user_id);
        $this->assertSame('source_post', $event->attribution_context);
        $this->assertSame($post->id, $event->post_id);
    }

    public function test_record_profile_visit_falls_back_to_latest_active_boost(): void
    {
        $owner = $this->user('@owner');
        $actor = $this->user('@actor');
        $post = $this->postFor($owner);
        $boost = $this->activeBoost($post, $owner);

        $this->assertTrue(BoostAnalyticsService::recordProfileVisitForUser($owner->id, $actor->id));

        $event = BoostAnalyticsEvent::where('boost_id', $boost->id)->where('event_type', 'profile_visit')->firstOrFail();
        $this->assertSame('fallback_active_boost', $event->attribution_context);
    }

    public function test_record_message_start_rejects_conversation_with_existing_messages(): void
    {
        $sender = $this->user('@sender');
        $recipient = $this->user('@recipient');
        $post = $this->postFor($recipient);
        $this->activeBoost($post, $recipient);

        Message::create([
            'conversation_id' => Message::getConversationId('@sender', '@recipient'),
            'sender_handle' => '@sender',
            'recipient_handle' => '@recipient',
            'text' => 'hi',
        ]);

        $this->assertFalse(BoostAnalyticsService::recordMessageStartForConversation('@sender', '@recipient'));
    }

    public function test_record_message_start_returns_false_without_recipient_boost(): void
    {
        $sender = $this->user('@sender');
        $recipient = $this->user('@recipient');

        $this->assertFalse(BoostAnalyticsService::recordMessageStartForConversation('@sender', '@recipient'));
    }

    public function test_record_message_start_uses_source_post_context(): void
    {
        $sender = $this->user('@sender');
        $recipient = $this->user('@recipient');
        $post = $this->postFor($recipient);
        $boost = $this->activeBoost($post, $recipient);

        $this->assertTrue(BoostAnalyticsService::recordMessageStartForConversation('@sender', '@recipient', $post->id));

        $event = BoostAnalyticsEvent::where('boost_id', $boost->id)->where('event_type', 'message_start')->firstOrFail();
        $this->assertSame('source_post', $event->attribution_context);
        $this->assertSame($post->id, $event->post_id);
    }

    public function test_record_message_start_falls_back_to_boost_by_handle(): void
    {
        $sender = $this->user('@sender');
        $recipient = $this->user('@recipient');
        $post = $this->postFor($recipient);
        $boost = $this->activeBoost($post, $recipient);

        $this->assertTrue(BoostAnalyticsService::recordMessageStartForConversation('@sender', '@recipient'));

        $event = BoostAnalyticsEvent::where('boost_id', $boost->id)->where('event_type', 'message_start')->firstOrFail();
        $this->assertSame('fallback_active_boost', $event->attribution_context);
    }
}
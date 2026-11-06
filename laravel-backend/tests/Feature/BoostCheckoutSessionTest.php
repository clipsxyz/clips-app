<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\BoostCheckoutController;
use App\Http\Controllers\Api\BoostController;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use ReflectionMethod;
use Tests\TestCase;

class BoostCheckoutSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_checkout_session_requires_the_boost_fields(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/boosts/create-checkout-session', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['post_id', 'radius', 'tier', 'duration']);
    }

    public function test_checkout_session_rejects_unknown_tiers_and_a_short_radius(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/boosts/create-checkout-session', [
                'post_id' => $post->id,
                'radius' => 0.5,
                'tier' => 'local',
                'duration' => 6,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['radius', 'tier']);
    }

    public function test_checkout_session_rejects_another_users_post(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $owner->id, 'user_handle' => $owner->handle]);

        $this->actingAs($other, 'sanctum')
            ->postJson('/api/boosts/create-checkout-session', [
                'post_id' => $post->id,
                'radius' => 5,
                'tier' => 'standard',
                'duration' => 6,
            ])
            ->assertStatus(403)
            ->assertJsonPath('error', 'You do not own this post');
    }

    public function test_checkout_returns_to_the_local_app_url(): void
    {
        config(['app.url' => 'http://192.168.1.15:8000']);
        $method = new ReflectionMethod(BoostCheckoutController::class, 'localReturnUrls');
        $method->setAccessible(true);
        $urls = $method->invoke(new BoostCheckoutController());

        $this->assertSame(
            'http://192.168.1.15:8000/boost/success?session_id={CHECKOUT_SESSION_ID}',
            $urls['success_url']
        );
        $this->assertSame('http://192.168.1.15:8000/boost/cancel', $urls['cancel_url']);
    }

    public function test_amount_uses_the_tier_base_and_duration_multiplier(): void
    {
        $method = new ReflectionMethod(BoostCheckoutController::class, 'amountCents');
        $method->setAccessible(true);
        $controller = new BoostCheckoutController();

        $this->assertSame(499, $method->invoke($controller, 'standard', 6));
        $this->assertSame(873, $method->invoke($controller, 'standard', 12));
        $this->assertSame(2797, $method->invoke($controller, 'premium', 24));
        $this->assertSame(12394, $method->invoke($controller, 'featured', 72));
    }

    public function test_local_quote_uses_the_audience_budget_shown_in_the_boost_sheet(): void
    {
        $this->app['env'] = 'local';
        $user = User::factory()->create();

        $cents = app(BoostController::class)->audiencePriceCents((string) $user->id, 'local', 2, 6);

        $this->assertSame(750, $cents);
    }
}

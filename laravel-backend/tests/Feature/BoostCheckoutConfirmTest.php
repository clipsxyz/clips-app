<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Services\StripeCheckoutSessionLookup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Stripe\Checkout\Session;
use Tests\TestCase;

class BoostCheckoutConfirmTest extends TestCase
{
    use RefreshDatabase;

    public function test_returning_from_checkout_marks_the_post_active(): void
    {
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create();
        Sanctum::actingAs($owner);

        $this->mock(StripeCheckoutSessionLookup::class, function ($mock) use ($owner, $post) {
            $mock->shouldReceive('find')
                ->once()
                ->with('cs_test_confirm1')
                ->andReturn(Session::constructFrom([
                    'id' => 'cs_test_confirm1',
                    'payment_status' => 'paid',
                    'amount_total' => 499,
                    'currency' => 'eur',
                    'metadata' => [
                        'user_id' => (string) $owner->id,
                        'post_id' => (string) $post->id,
                        'radius' => '2',
                        'tier' => 'standard',
                        'duration' => '6',
                    ],
                ]));
        });

        $this->postJson('/api/boosts/confirm-checkout', [
            'session_id' => 'cs_test_confirm1',
        ])
            ->assertOk()
            ->assertJsonPath('post_id', (string) $post->id)
            ->assertJsonPath('feed_type', 'local');

        $post->refresh();
        $this->assertTrue($post->is_boosted);
        $this->assertTrue($post->boosted_until->isFuture());
        $this->assertDatabaseHas('boosts', [
            'post_id' => $post->id,
            'status' => 'active',
            'feed_type' => 'local',
        ]);
    }
}

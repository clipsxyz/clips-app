<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\BoostTransaction;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BoostInsightsSpendTest extends TestCase
{
    use RefreshDatabase;

    public function test_insights_spend_uses_the_charged_boost_price(): void
    {
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create();
        Boost::factory()->forPost($post)->create([
            'price' => 4.99,
            'duration_hours' => 6,
            'feed_type' => 'local',
            'status' => 'active',
            'expires_at' => now()->addHours(6),
        ]);
        Sanctum::actingAs($owner);

        $this->getJson('/api/boost/analytics/'.$post->id)
            ->assertOk()
            ->assertJsonPath('spend', 4.99)
            ->assertJsonPath('spendEur', 4.99);
    }

    public function test_insights_spend_falls_back_to_the_payment_amount(): void
    {
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create();
        $boost = Boost::factory()->forPost($post)->create([
            'price' => 0,
            'duration_hours' => 12,
            'feed_type' => 'regional',
            'status' => 'active',
            'expires_at' => now()->addHours(12),
        ]);
        BoostTransaction::query()->create([
            'stripe_session_id' => 'cs_test_spend_fallback',
            'post_id' => $post->id,
            'user_id' => $owner->id,
            'radius' => 8,
            'tier' => 'premium',
            'duration' => 12,
            'amount_cents' => 1748,
            'currency' => 'eur',
            'paid_at' => now(),
        ]);
        Sanctum::actingAs($owner);

        $this->getJson('/api/boost/analytics/'.$post->id)
            ->assertOk()
            ->assertJsonPath('spend', 17.48)
            ->assertJsonPath('spendEur', 17.48);

        $this->assertNotNull($boost->id);
    }

    public function test_insights_spend_uses_the_stripe_charge_ahead_of_a_stored_price(): void
    {
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create();
        Boost::factory()->forPost($post)->create([
            'price' => 4.99,
            'duration_hours' => 6,
            'feed_type' => 'local',
            'status' => 'active',
            'expires_at' => now()->addHours(6),
        ]);
        BoostTransaction::query()->create([
            'stripe_session_id' => 'cs_test_real_charge',
            'post_id' => $post->id,
            'user_id' => $owner->id,
            'radius' => 2,
            'tier' => 'standard',
            'duration' => 6,
            'amount_cents' => 2500,
            'currency' => 'eur',
            'paid_at' => now(),
        ]);
        Sanctum::actingAs($owner);

        $this->getJson('/api/boost/analytics/'.$post->id)
            ->assertOk()
            ->assertJsonPath('spend', 25)
            ->assertJsonPath('spendEur', 25);
    }

    public function test_insights_spend_is_zero_when_nothing_was_charged(): void
    {
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create();
        Boost::factory()->forPost($post)->create([
            'price' => 0,
            'duration_hours' => 6,
            'feed_type' => 'local',
            'status' => 'active',
            'expires_at' => now()->addHours(6),
        ]);
        Sanctum::actingAs($owner);

        $this->getJson('/api/boost/analytics/'.$post->id)
            ->assertOk()
            ->assertJsonPath('spend', 0)
            ->assertJsonPath('spendEur', 0);
    }
}

<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SimulateBoostPaymentCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_simulate_payment_command_activates_a_pending_boost(): void
    {
        $owner = User::factory()->create();
        $post = Post::factory()->forUser($owner)->create();
        $boost = Boost::factory()->forPost($post)->create([
            'status' => 'pending',
            'duration_hours' => 6,
            'activated_at' => now()->subDay(),
            'expires_at' => now()->subHour(),
        ]);

        $this->artisan('boost:simulate-payment', ['boost_id' => $boost->id])
            ->assertExitCode(0);

        $boost->refresh();
        $this->assertSame('active', $boost->status);
        $this->assertNotNull($boost->expires_at);
    }
}

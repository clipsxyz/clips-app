<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmailDigestPreferenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_disable_email_digest_via_profile(): void
    {
        $user = User::factory()->create(['email_digest_enabled' => true]);

        $response = $this->actingAs($user, 'sanctum')
            ->putJson('/api/auth/profile', ['email_digest_enabled' => false]);

        $response->assertOk()
            ->assertJsonPath('email_digest_enabled', false);

        $this->assertFalse($user->fresh()->email_digest_enabled);
    }
}

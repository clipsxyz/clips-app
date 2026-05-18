<?php

namespace Tests\Feature;

use App\Models\EngagementEmailLog;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class InactiveDigestCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_sends_digest_to_inactive_user_with_area_posts(): void
    {
        Mail::fake();

        $author = User::factory()->create([
            'location_regional' => 'Dublin',
            'handle' => 'Author@Dublin',
        ]);

        $inactive = User::factory()->create([
            'email' => 'inactive@example.com',
            'location_regional' => 'Dublin',
            'last_active_at' => now()->subDays(5),
            'email_digest_enabled' => true,
        ]);

        Post::factory()->create([
            'user_id' => $author->id,
            'user_handle' => $author->handle,
            'text_content' => 'Court news update',
            'location_label' => 'Dublin',
        ]);

        $code = Artisan::call('engagement:send-inactive-digests');
        $this->assertSame(0, $code);

        Mail::assertSent(\App\Mail\InactiveDigestMail::class, function ($mail) {
            return $mail->hasTo('inactive@example.com');
        });

        $this->assertDatabaseHas('engagement_email_logs', [
            'user_id' => $inactive->id,
            'type' => 'inactive_digest',
        ]);
    }

    public function test_skips_user_without_new_activity(): void
    {
        Mail::fake();

        User::factory()->create([
            'email' => 'quiet@example.com',
            'last_active_at' => now()->subDays(5),
            'email_digest_enabled' => true,
        ]);

        Artisan::call('engagement:send-inactive-digests');

        Mail::assertNothingSent();
    }

    public function test_respects_digest_cooldown(): void
    {
        Mail::fake();

        $user = User::factory()->create([
            'email' => 'cooldown@example.com',
            'location_regional' => 'Dublin',
            'last_active_at' => now()->subDays(5),
            'email_digest_enabled' => true,
        ]);

        $author = User::factory()->create(['location_regional' => 'Dublin']);
        Post::factory()->create(['user_id' => $author->id, 'user_handle' => $author->handle]);

        EngagementEmailLog::create([
            'user_id' => $user->id,
            'type' => 'inactive_digest',
            'payload' => ['test' => true],
            'sent_at' => now()->subHours(2),
        ]);

        Artisan::call('engagement:send-inactive-digests');

        Mail::assertNothingSent();
    }
}

<?php

namespace Tests\Feature;

use App\Models\Boost;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BoostNativePurchaseTest extends TestCase
{
    use RefreshDatabase;

    public function test_google_play_receipt_activates_the_boost(): void
    {
        $this->app['env'] = 'local';
        config([
            'services.google_play.access_token' => 'test-token',
            'services.google_play.package_name' => 'com.clipsapp',
        ]);
        Http::fake([
            'androidpublisher.googleapis.com/*' => Http::response(['purchaseState' => 0], 200),
        ]);

        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/boosts/verify-native-purchase', [
                'platform' => 'android',
                'product_id' => 'gazetteer.boost.6h',
                'purchase_token' => 'play-token-1',
                'post_id' => $post->id,
                'radius' => 5,
                'tier' => 'standard',
                'duration' => 6,
            ]);

        $boost = Boost::query()->where('post_id', $post->id)->where('status', 'active')->first();
        $this->assertNotNull($boost);
        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('created', true)
            ->assertJsonPath('boost_id', $boost->id)
            ->assertJsonPath('post_id', $post->id);
        $this->assertTrue($boost->expires_at->equalTo($boost->activated_at->copy()->addHours(6)));
        Http::assertSent(fn ($request) => str_contains($request->url(), 'purchases/products/gazetteer.boost.6h'));
    }

    public function test_unpaid_google_play_receipt_does_not_activate_the_boost(): void
    {
        config(['services.google_play.access_token' => 'test-token']);
        Http::fake([
            'androidpublisher.googleapis.com/*' => Http::response(['purchaseState' => 1], 200),
        ]);
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/boosts/verify-native-purchase', [
                'platform' => 'android',
                'product_id' => 'gazetteer.boost.6h',
                'purchase_token' => 'play-token-2',
                'post_id' => $post->id,
                'radius' => 5,
                'tier' => 'standard',
                'duration' => 6,
            ])
            ->assertStatus(422);

        $this->assertFalse(Boost::query()->where('post_id', $post->id)->exists());
    }

    public function test_store_verification_without_credentials_does_not_activate_the_boost(): void
    {
        config([
            'services.google_play.access_token' => null,
            'services.google_play.service_account' => null,
        ]);
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/boosts/verify-native-purchase', [
                'platform' => 'android',
                'product_id' => 'gazetteer.boost.6h',
                'purchase_token' => 'play-token-3',
                'post_id' => $post->id,
                'radius' => 5,
                'tier' => 'standard',
                'duration' => 6,
            ])
            ->assertStatus(503);

        $this->assertFalse(Boost::query()->where('post_id', $post->id)->exists());
    }

    public function test_app_store_receipt_must_include_the_boost_product(): void
    {
        config(['services.app_store.shared_secret' => 'shared-secret']);
        Http::fake([
            'buy.itunes.apple.com/*' => Http::response([
                'status' => 0,
                'receipt' => ['in_app' => [['product_id' => 'gazetteer.boost.12h']]],
            ], 200),
        ]);
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/boosts/verify-native-purchase', [
                'platform' => 'ios',
                'product_id' => 'gazetteer.boost.12h',
                'purchase_token' => 'apple-transaction-1',
                'receipt' => 'receipt-body',
                'post_id' => $post->id,
                'radius' => 5,
                'tier' => 'standard',
                'duration' => 12,
            ])
            ->assertOk()
            ->assertJsonPath('created', true);
    }

    public function test_sandbox_receipt_is_checked_again_with_apple_sandbox(): void
    {
        config(['services.app_store.shared_secret' => 'shared-secret']);
        Http::fake([
            'buy.itunes.apple.com/*' => Http::response(['status' => 21007], 200),
            'sandbox.itunes.apple.com/*' => Http::response([
                'status' => 0,
                'receipt' => ['in_app' => [['product_id' => 'gazetteer.boost.6h']]],
            ], 200),
        ]);
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/boosts/verify-native-purchase', [
                'platform' => 'ios',
                'product_id' => 'gazetteer.boost.6h',
                'purchase_token' => 'apple-transaction-sandbox',
                'receipt_data' => 'sandbox-receipt',
                'post_id' => $post->id,
                'radius' => 5,
                'tier' => 'standard',
                'duration' => 6,
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success');

        Http::assertSent(fn ($request) => str_contains($request->url(), 'sandbox.itunes.apple.com'));
    }

    public function test_google_service_account_json_content_can_sign_in(): void
    {
        $key = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);
        $this->assertNotFalse($key);
        $private = '';
        $this->assertTrue(openssl_pkey_export($key, $private));

        config([
            'services.google_play.access_token' => null,
            'services.google_play.package_name' => 'com.clipsapp',
            'services.google_play.service_account' => json_encode([
                'client_email' => 'play@gazetteer.iam.gserviceaccount.com',
                'private_key' => $private,
            ]),
        ]);
        Http::fake([
            'oauth2.googleapis.com/*' => Http::response(['access_token' => 'minted-token'], 200),
            'androidpublisher.googleapis.com/*' => Http::response(['purchaseState' => 0], 200),
        ]);

        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id, 'user_handle' => $user->handle]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/boosts/verify-native-purchase', [
                'platform' => 'android',
                'product_id' => 'gazetteer.boost.24h',
                'purchaseToken' => 'play-token-json',
                'post_id' => $post->id,
                'radius' => 5,
                'tier' => 'standard',
                'duration' => 24,
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $boost = Boost::query()->where('post_id', $post->id)->first();
        $this->assertNotNull($boost);
        $this->assertTrue($boost->expires_at->equalTo($boost->activated_at->copy()->addHours(24)));
    }
}

<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class StorePurchaseRejected extends RuntimeException
{
}

class StoreVerificationUnavailable extends RuntimeException
{
}

class NativeStorePurchaseVerifier
{
    public function assertPurchased(string $platform, string $productId, string $purchaseToken, ?string $receipt): void
    {
        if ($platform === 'android') {
            $this->assertGooglePlay($productId, $purchaseToken);

            return;
        }

        $this->assertAppStore($productId, $receipt ?: $purchaseToken);
    }

    private function assertGooglePlay(string $productId, string $purchaseToken): void
    {
        $accessToken = $this->googleAccessToken();
        $package = trim((string) config('services.google_play.package_name', 'com.clipsapp'));
        $url = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'
            .rawurlencode($package)
            .'/purchases/products/'
            .rawurlencode($productId)
            .'/tokens/'
            .rawurlencode($purchaseToken);

        $response = Http::withToken($accessToken)->timeout(12)->get($url);
        if (! $response->successful()) {
            Log::warning('Google Play purchase lookup failed', [
                'status' => $response->status(),
                'product_id' => $productId,
            ]);
            throw new StorePurchaseRejected('Google Play did not accept this purchase');
        }

        if ((int) $response->json('purchaseState') !== 0) {
            throw new StorePurchaseRejected('Google Play purchase is not paid');
        }
    }

    private function googleAccessToken(): string
    {
        $configured = trim((string) config('services.google_play.access_token', ''));
        if ($configured !== '') {
            return $configured;
        }

        $account = $this->googleServiceAccount();
        if ($account === null) {
            throw new StoreVerificationUnavailable('Google Play verification is not configured');
        }

        $now = time();
        $header = $this->base64Url((string) json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $claim = $this->base64Url((string) json_encode([
            'iss' => $account['client_email'],
            'scope' => 'https://www.googleapis.com/auth/androidpublisher',
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => $now,
            'exp' => $now + 3600,
        ]));
        $unsigned = $header.'.'.$claim;
        $signature = '';
        if (! openssl_sign($unsigned, $signature, $account['private_key'], OPENSSL_ALGO_SHA256)) {
            throw new StoreVerificationUnavailable('Google Play verification could not sign in');
        }

        $response = Http::asForm()->timeout(12)->post('https://oauth2.googleapis.com/token', [
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $unsigned.'.'.$this->base64Url($signature),
        ]);
        $token = (string) ($response->json('access_token') ?? '');
        if (! $response->successful() || $token === '') {
            throw new StoreVerificationUnavailable('Google Play verification could not sign in');
        }

        return $token;
    }

    /**
     * @return array{client_email: string, private_key: string}|null
     */
    private function googleServiceAccount(): ?array
    {
        $configured = trim((string) config('services.google_play.service_account', ''));
        if ($configured === '') {
            return null;
        }

        if (str_starts_with($configured, '{')) {
            $json = json_decode($configured, true);
        } else {
            $path = $configured;
            if (! str_starts_with($path, '/') && ! is_file($path)) {
                $path = base_path($configured);
            }
            if (! is_file($path)) {
                return null;
            }
            $json = json_decode((string) file_get_contents($path), true);
        }

        if (! is_array($json)) {
            return null;
        }
        $email = trim((string) ($json['client_email'] ?? ''));
        $key = (string) ($json['private_key'] ?? '');
        if ($email === '' || $key === '') {
            return null;
        }

        return ['client_email' => $email, 'private_key' => $key];
    }

    private function assertAppStore(string $productId, string $receipt): void
    {
        $secret = trim((string) config('services.app_store.shared_secret', ''));
        if ($secret === '') {
            throw new StoreVerificationUnavailable('App Store verification is not configured');
        }
        if (trim($receipt) === '') {
            throw new StorePurchaseRejected('The App Store receipt is missing');
        }

        $payload = [
            'receipt-data' => $receipt,
            'password' => $secret,
            'exclude-old-transactions' => true,
        ];
        $response = Http::timeout(12)->post('https://buy.itunes.apple.com/verifyReceipt', $payload);
        $status = (int) $response->json('status');
        if ($status === 21007) {
            $response = Http::timeout(12)->post('https://sandbox.itunes.apple.com/verifyReceipt', $payload);
            $status = (int) $response->json('status');
        }
        if ($status !== 0) {
            throw new StorePurchaseRejected('The App Store did not accept this receipt');
        }

        $items = array_merge(
            (array) $response->json('receipt.in_app', []),
            (array) $response->json('latest_receipt_info', []),
        );
        foreach ($items as $item) {
            if (is_array($item) && (string) ($item['product_id'] ?? '') === $productId) {
                return;
            }
        }

        throw new StorePurchaseRejected('The App Store receipt does not include this boost');
    }

    private function base64Url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}

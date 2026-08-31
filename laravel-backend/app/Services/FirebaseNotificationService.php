<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Firebase Cloud Messaging (HTTP v1) sender using a service-account JSON.
 */
class FirebaseNotificationService
{
    private ?string $cachedAccessToken = null;

    private ?int $cachedAccessTokenExpiresAt = null;

    public function isConfigured(): bool
    {
        return $this->projectId() !== '' && is_array($this->serviceAccount());
    }

    public function projectId(): string
    {
        $fromConfig = trim((string) config('services.firebase.project_id', ''));
        if ($fromConfig !== '') {
            return $fromConfig;
        }
        $sa = $this->serviceAccount();

        return is_array($sa) ? trim((string) ($sa['project_id'] ?? '')) : '';
    }

    /**
     * @return array<string, mixed>|null
     */
    public function serviceAccount(): ?array
    {
        $relative = (string) config('services.firebase.credentials', 'storage/app/firebase-auth.json');
        $path = $relative;
        if ($path !== '' && $path[0] !== '/' && ! preg_match('#^[A-Za-z]:\\\\#', $path)) {
            $path = base_path($relative);
            if (! is_file($path)) {
                $path = storage_path('app/'.ltrim(str_replace('storage/app/', '', $relative), '/'));
            }
        }
        if (! is_file($path)) {
            return null;
        }
        try {
            $json = json_decode((string) file_get_contents($path), true);

            return is_array($json) ? $json : null;
        } catch (\Throwable $_) {
            return null;
        }
    }

    /**
     * Send a data+notification push to every registered token for a user.
     *
     * @param  array<string, string>  $data
     * @return array{sent: int, failed: int, configured: bool}
     */
    public function sendToUser(string $userId, string $title, string $body, array $data = []): array
    {
        $tokens = $this->tokensForUser($userId);
        if ($tokens === []) {
            return ['sent' => 0, 'failed' => 0, 'configured' => $this->isConfigured()];
        }

        return $this->sendToTokens($tokens, $title, $body, $data);
    }

    /**
     * @param  list<string>  $tokens
     * @param  array<string, string>  $data
     * @return array{sent: int, failed: int, configured: bool}
     */
    public function sendToTokens(array $tokens, string $title, string $body, array $data = []): array
    {
        if (! $this->isConfigured()) {
            Log::warning('FCM not configured — skipping push', [
                'project_id' => $this->projectId(),
                'has_credentials' => $this->serviceAccount() !== null,
            ]);

            return ['sent' => 0, 'failed' => 0, 'configured' => false];
        }

        $accessToken = $this->accessToken();
        if ($accessToken === null) {
            return ['sent' => 0, 'failed' => count($tokens), 'configured' => true];
        }

        $projectId = $this->projectId();
        $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";
        $stringData = [];
        foreach ($data as $key => $value) {
            $stringData[(string) $key] = (string) $value;
        }

        $sent = 0;
        $failed = 0;
        foreach ($tokens as $token) {
            $token = trim((string) $token);
            if ($token === '') {
                continue;
            }
            $payload = [
                'message' => [
                    'token' => $token,
                    'notification' => [
                        'title' => $title,
                        'body' => $body,
                    ],
                    'data' => $stringData,
                    'android' => [
                        'priority' => 'HIGH',
                    ],
                    'apns' => [
                        'headers' => [
                            'apns-priority' => '10',
                        ],
                        'payload' => [
                            'aps' => [
                                'sound' => 'default',
                            ],
                        ],
                    ],
                ],
            ];

            try {
                $response = Http::withToken($accessToken)
                    ->timeout(8)
                    ->post($url, $payload);
                if ($response->successful()) {
                    $sent++;
                    continue;
                }
                $failed++;
                $bodyJson = $response->json();
                $errorCode = (string) data_get($bodyJson, 'error.status', $response->status());
                Log::warning('FCM send failed', [
                    'status' => $response->status(),
                    'error' => $errorCode,
                    'message' => data_get($bodyJson, 'error.message'),
                ]);
                if (in_array($errorCode, ['NOT_FOUND', 'UNREGISTERED', 'INVALID_ARGUMENT'], true)
                    || str_contains(strtolower((string) data_get($bodyJson, 'error.message', '')), 'not a valid fcm')) {
                    $this->forgetToken($token);
                }
            } catch (\Throwable $e) {
                $failed++;
                Log::warning('FCM send exception', ['error' => $e->getMessage()]);
            }
        }

        return ['sent' => $sent, 'failed' => $failed, 'configured' => true];
    }

    /**
     * @return list<string>
     */
    public function tokensForUser(string $userId): array
    {
        if (! Schema::hasTable('fcm_tokens')) {
            return [];
        }
        $userId = trim($userId);
        if ($userId === '' || strtolower($userId) === 'unknown') {
            return [];
        }

        return DB::table('fcm_tokens')
            ->where('user_id', $userId)
            ->pluck('token')
            ->filter(fn ($t) => is_string($t) && trim($t) !== '')
            ->map(fn ($t) => trim((string) $t))
            ->unique()
            ->values()
            ->all();
    }

    public function forgetToken(string $token): void
    {
        if (! Schema::hasTable('fcm_tokens') || trim($token) === '') {
            return;
        }
        DB::table('fcm_tokens')->where('token', $token)->delete();
    }

    private function accessToken(): ?string
    {
        if ($this->cachedAccessToken && $this->cachedAccessTokenExpiresAt
            && time() < ($this->cachedAccessTokenExpiresAt - 60)) {
            return $this->cachedAccessToken;
        }

        $sa = $this->serviceAccount();
        if (! is_array($sa)) {
            return null;
        }
        $clientEmail = (string) ($sa['client_email'] ?? '');
        $privateKey = (string) ($sa['private_key'] ?? '');
        if ($clientEmail === '' || $privateKey === '') {
            return null;
        }

        $now = time();
        $jwtHeader = $this->base64UrlEncode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $jwtClaim = $this->base64UrlEncode(json_encode([
            'iss' => $clientEmail,
            'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => $now,
            'exp' => $now + 3600,
        ]));
        $unsigned = $jwtHeader.'.'.$jwtClaim;
        $signature = '';
        $ok = openssl_sign($unsigned, $signature, $privateKey, OPENSSL_ALGO_SHA256);
        if (! $ok) {
            Log::error('FCM JWT sign failed');

            return null;
        }
        $jwt = $unsigned.'.'.$this->base64UrlEncode($signature);

        try {
            $response = Http::asForm()->timeout(8)->post('https://oauth2.googleapis.com/token', [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $jwt,
            ]);
            if (! $response->successful()) {
                Log::warning('FCM OAuth token failed', ['status' => $response->status(), 'body' => $response->body()]);

                return null;
            }
            $accessToken = (string) ($response->json('access_token') ?? '');
            $expiresIn = (int) ($response->json('expires_in') ?? 3600);
            if ($accessToken === '') {
                return null;
            }
            $this->cachedAccessToken = $accessToken;
            $this->cachedAccessTokenExpiresAt = time() + max(60, $expiresIn);

            return $accessToken;
        } catch (\Throwable $e) {
            Log::warning('FCM OAuth exception', ['error' => $e->getMessage()]);

            return null;
        }
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}

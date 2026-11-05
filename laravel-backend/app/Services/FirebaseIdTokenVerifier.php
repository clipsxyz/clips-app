<?php

namespace App\Services;

use Kreait\Firebase\Exception\Auth\FailedToVerifyToken;
use Kreait\Firebase\Factory;
use RuntimeException;

class FirebaseIdTokenVerifier
{
    /**
     * Verify a Firebase phone-auth ID token and return the signed-in identity.
     *
     * @return array{firebase_uid: string, phone_number: string}
     */
    public function verify(string $idToken): array
    {
        $credentials = config('services.firebase.credentials');
        if (! is_string($credentials) || $credentials === '' || ! is_readable($credentials)) {
            throw new RuntimeException('Firebase credentials are not configured');
        }

        $firebase = (new Factory)->withServiceAccount($credentials);
        $auth = $firebase->createAuth();

        try {
            $verifiedIdToken = $auth->verifyIdToken($idToken);
        } catch (FailedToVerifyToken $e) {
            throw new RuntimeException('Invalid Firebase token', 0, $e);
        }

        $claims = $verifiedIdToken->claims();
        $uid = trim((string) $claims->get('sub', ''));
        $phone = trim((string) $claims->get('phone_number', ''));
        $firebaseClaim = $claims->get('firebase', []);
        if (is_object($firebaseClaim)) {
            $decoded = json_decode(json_encode($firebaseClaim), true);
            $firebaseClaim = is_array($decoded) ? $decoded : [];
        }
        $provider = is_array($firebaseClaim) ? (string) ($firebaseClaim['sign_in_provider'] ?? '') : '';

        if ($uid === '' || $provider !== 'phone' || ! preg_match('/^\+[1-9]\d{7,14}$/', $phone)) {
            throw new RuntimeException('Firebase token is not a verified phone sign-in');
        }

        return [
            'firebase_uid' => $uid,
            'phone_number' => $phone,
        ];
    }
}

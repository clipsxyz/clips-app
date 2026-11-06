<?php

namespace App\Services;

/**
 * Sends an FCM notification to a user's registered device tokens.
 */
class PushNotificationService
{
    public function __construct(
        private readonly FirebaseNotificationService $fcm = new FirebaseNotificationService
    ) {
    }

    /**
     * @param  array<string, string>  $data
     */
    public function sendToUser(string $userId, string $title, string $body, array $data = []): void
    {
        $this->fcm->sendToUser($userId, $title, $body, $data);
    }

    /**
     * @param  array<string, string>  $data
     */
    public function sendToToken(string $token, string $title, string $body, array $data = []): void
    {
        $result = $this->fcm->sendToTokens([trim($token)], $title, $body, $data);
        if (($result['sent'] ?? 0) < 1) {
            throw new \RuntimeException('FCM push was not delivered');
        }
    }
}

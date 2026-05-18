<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InactiveDigestMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param array<string, mixed> $digest
     */
    public function __construct(
        public User $user,
        public array $digest,
        public string $openUrl,
    ) {}

    public function envelope(): Envelope
    {
        $area = $this->digest['regional_label'] ?? 'your area';
        $count = (int) ($this->digest['area_post_count'] ?? 0)
            + (int) ($this->digest['following_post_count'] ?? 0);

        $subject = $count > 0
            ? "You have {$count} new posts waiting in {$area}"
            : "See what you missed on Gazetteer";

        return new Envelope(
            subject: $subject,
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.inactive-digest',
            with: [
                'user' => $this->user,
                'digest' => $this->digest,
                'openUrl' => $this->openUrl,
            ],
        );
    }
}

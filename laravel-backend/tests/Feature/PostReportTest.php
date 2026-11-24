<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\PostReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PostReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_report_stores_the_reason_and_follow_up_answers(): void
    {
        $reporter = User::factory()->create();
        $author = User::factory()->create();
        $post = Post::factory()->forUser($author)->create();
        Sanctum::actingAs($reporter);

        $this->postJson("/api/posts/{$post->id}/report", [
            'reason' => 'harassment',
            'details' => "Who is this targeting?: Me\nHow is it harassment?: Threats",
            'answers' => [
                ['question' => 'Who is this targeting?', 'answer' => 'Me', 'choiceId' => 'me'],
                ['question' => 'How is it harassment?', 'answer' => 'Threats', 'choiceId' => 'threats'],
            ],
        ])->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('status', 'pending');

        $row = PostReport::query()->first();
        $this->assertNotNull($row);
        $this->assertSame($reporter->id, $row->reporter_user_id);
        $this->assertNotSame($author->id, $row->reporter_user_id);
        $this->assertSame('harassment', $row->reason);
        $this->assertSame('pending', $row->status);
        $this->assertSame('Threats', $row->answers[1]['answer']);

        $this->postJson("/api/posts/{$post->id}/report", [
            'reason' => 'spam',
            'answers' => [
                ['question' => 'What kind of spam is this?', 'answer' => 'Repetitive posting', 'choiceId' => 'repetitive'],
            ],
        ])->assertOk();

        $this->assertSame(1, PostReport::query()->count());
        $this->assertSame('spam', $row->fresh()->reason);
    }
}

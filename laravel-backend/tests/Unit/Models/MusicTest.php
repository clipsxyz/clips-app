<?php

namespace Tests\Unit\Models;

use App\Models\Music;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MusicTest extends TestCase
{
    use RefreshDatabase;

    protected function createTrack(array $overrides = []): Music
    {
        return Music::create(array_merge([
            'title' => 'Test Track',
            'artist' => 'Test Artist',
            'genre' => 'pop',
            'mood' => 'happy',
            'duration' => 120,
            'url' => 'https://example.com/music.wav',
            'is_ai_generated' => false,
            'is_active' => true,
            'usage_count' => 0,
            'license_type' => null,
            'license_url' => null,
            'license_requires_attribution' => false,
        ], $overrides));
    }

    public function test_active_scope_returns_only_active_tracks(): void
    {
        $active = $this->createTrack(['is_active' => true, 'title' => 'Active']);
        $this->createTrack(['is_active' => false, 'title' => 'Inactive']);

        $results = Music::active()->pluck('id')->all();

        $this->assertContains($active->id, $results);
        $this->assertCount(1, $results);
    }

    public function test_by_genre_scope_filters_by_genre(): void
    {
        $pop = $this->createTrack(['genre' => 'pop', 'title' => 'Pop Track']);
        $this->createTrack(['genre' => 'rock', 'title' => 'Rock Track']);

        $results = Music::byGenre('pop')->pluck('id')->all();

        $this->assertContains($pop->id, $results);
        $this->assertCount(1, $results);
    }

    public function test_by_mood_scope_filters_by_mood(): void
    {
        $happy = $this->createTrack(['mood' => 'happy', 'title' => 'Happy Track']);
        $this->createTrack(['mood' => 'calm', 'title' => 'Calm Track']);

        $results = Music::byMood('happy')->pluck('id')->all();

        $this->assertContains($happy->id, $results);
        $this->assertCount(1, $results);
    }

    public function test_ai_generated_and_library_scopes_filter_correctly(): void
    {
        $aiTrack = $this->createTrack(['is_ai_generated' => true, 'title' => 'AI Track']);
        $libraryTrack = $this->createTrack(['is_ai_generated' => false, 'title' => 'Library Track']);

        $aiResults = Music::aiGenerated()->pluck('id')->all();
        $libraryResults = Music::library()->pluck('id')->all();

        $this->assertContains($aiTrack->id, $aiResults);
        $this->assertNotContains($libraryTrack->id, $aiResults);

        $this->assertContains($libraryTrack->id, $libraryResults);
        $this->assertNotContains($aiTrack->id, $libraryResults);
    }

    public function test_license_safe_scope_includes_only_safe_licenses(): void
    {
        $safe = $this->createTrack([
            'license_type' => 'CC-BY',
            'title' => 'Safe Track',
        ]);

        $unsafe = $this->createTrack([
            'license_type' => 'CC-ND',
            'title' => 'Unsafe Track',
        ]);

        $noLicense = $this->createTrack([
            'license_type' => null,
            'title' => 'No License Track',
        ]);

        $results = Music::licenseSafe()->pluck('id')->all();

        $this->assertContains($safe->id, $results);
        $this->assertContains($noLicense->id, $results);
        $this->assertNotContains($unsafe->id, $results);
    }

    public function test_increment_usage_increments_usage_count(): void
    {
        $track = $this->createTrack(['usage_count' => 0]);

        $track->incrementUsage();

        $this->assertEquals(1, $track->fresh()->usage_count);
    }

    public function test_get_attribution_text_returns_null_if_not_required(): void
    {
        $track = $this->createTrack([
            'license_requires_attribution' => false,
            'artist' => 'Artist',
            'title' => 'Title',
            'license_type' => 'CC0',
        ]);

        $this->assertNull($track->getAttributionText());
    }

    public function test_get_attribution_text_returns_formatted_string_when_required(): void
    {
        $track = $this->createTrack([
            'license_requires_attribution' => true,
            'artist' => 'Artist',
            'title' => 'Title',
            'license_type' => 'CC-BY',
        ]);

        $this->assertEquals(
            'Music: Artist - Title (CC-BY)',
            $track->getAttributionText()
        );
    }
}


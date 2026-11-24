<?php

namespace App\Console\Commands;

use App\Models\Post;
use App\Models\User;
use App\Services\GoogleMapsLocationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class FetchLocalNewsPosts extends Command
{
    protected $signature = 'gazetteer:fetch-news';

    protected $description = 'Import local RSS stories as posts from @GazetteerLocal, skipping articles already stored.';

    public function handle(GoogleMapsLocationService $maps): int
    {
        $feeds = config('automated_seeding.news_feeds', []);
        if (! is_array($feeds) || $feeds === []) {
            $this->error('Set NEWS_RSS_FEEDS to one or more RSS URLs.');

            return self::FAILURE;
        }

        $llmKey = trim((string) config('automated_seeding.llm.key'));
        if ($llmKey === '') {
            $this->error('Set NEWS_LLM_API_KEY so each story can be summarized and placed.');

            return self::FAILURE;
        }

        $author = $this->systemAuthor();
        $created = 0;
        $skipped = 0;

        foreach ($feeds as $feedUrl) {
            $items = $this->fetchFeed((string) $feedUrl);
            if ($items === null) {
                $this->warn('Could not read feed '.$feedUrl);
                continue;
            }

            foreach ($items as $item) {
                if (Post::withTrashed()->where('source_guid', $item['guid'])->exists()) {
                    $skipped++;
                    continue;
                }

                $summary = $this->summarize($item['title'], $item['description'], $llmKey);
                if ($summary === null) {
                    $this->warn('Skipped a story with no summary: '.$item['title']);
                    continue;
                }

                $place = $maps->resolve(null, $summary['place']);
                if ($place === null) {
                    $this->warn('Could not geocode "'.$summary['place'].'" for '.$item['title']);
                    continue;
                }

                Post::create([
                    'user_id' => $author->id,
                    'user_handle' => $author->handle,
                    'text_content' => $summary['summary'],
                    'caption' => $item['title'],
                    'location_label' => $place['label'] ?? $summary['place'],
                    'location_local' => $place['local'] ?? null,
                    'location_regional' => $place['regional'] ?? null,
                    'location_national' => $place['national'] ?? null,
                    'place_id' => $place['place_id'] ?? null,
                    'latitude' => $place['latitude'] ?? null,
                    'longitude' => $place['longitude'] ?? null,
                    'source_guid' => $item['guid'],
                    'source_url' => $item['url'],
                ]);
                $created++;
            }
        }

        if ($created > 0) {
            $author->posts_count = (int) $author->posts()->count();
            $author->save();
        }

        $this->info('Published '.$created.' local stories. Skipped '.$skipped.' already imported.');

        return self::SUCCESS;
    }

    private function systemAuthor(): User
    {
        $handle = (string) config('automated_seeding.system_handle', 'GazetteerLocal');

        return User::firstOrCreate(
            ['handle' => $handle],
            [
                'username' => $handle,
                'email' => 'gazetteer-local@gazetteer.app',
                'password' => Str::random(40),
                'display_name' => 'Gazetteer Local',
                'bio' => 'Local news published by Gazetteer.',
                'is_verified' => true,
            ]
        );
    }

    /**
     * @return list<array{guid: string, title: string, description: string, url: string|null}>|null
     */
    private function fetchFeed(string $url): ?array
    {
        try {
            $response = Http::timeout(12)
                ->withHeaders(['User-Agent' => 'GazetteerLocalNews/1.0'])
                ->get($url);
        } catch (\Throwable $e) {
            return null;
        }

        if (! $response->ok()) {
            return null;
        }

        $xml = @simplexml_load_string($response->body());
        if ($xml === false) {
            return null;
        }

        $nodes = $xml->channel->item ?? $xml->item ?? [];
        $items = [];
        $count = 0;
        foreach ($nodes as $node) {
            if ($count >= 15) {
                break;
            }
            $title = trim((string) ($node->title ?? ''));
            if ($title === '') {
                continue;
            }
            $link = trim((string) ($node->link ?? ''));
            $guid = trim((string) ($node->guid ?? ''));
            if ($guid === '') {
                $guid = $link !== '' ? $link : hash('sha256', $title);
            }
            $items[] = [
                'guid' => mb_substr($guid, 0, 255),
                'title' => $title,
                'description' => trim(strip_tags((string) ($node->description ?? ''))),
                'url' => $link !== '' ? mb_substr($link, 0, 2048) : null,
            ];
            $count++;
        }

        return $items;
    }

    /**
     * @return array{summary: string, place: string}|null
     */
    private function summarize(string $title, string $description, string $apiKey): ?array
    {
        $url = (string) config('automated_seeding.llm.url');
        $model = (string) config('automated_seeding.llm.model');

        try {
            $response = Http::timeout(20)
                ->withToken($apiKey)
                ->acceptJson()
                ->post($url, [
                    'model' => $model,
                    'response_format' => ['type' => 'json_object'],
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'Summarize a local news story in two or three sentences and name the specific neighborhood or city it is about. Reply with JSON: {"summary":"...","place":"neighborhood or city"}.',
                        ],
                        [
                            'role' => 'user',
                            'content' => "Title: {$title}\n\n{$description}",
                        ],
                    ],
                ]);
        } catch (\Throwable) {
            return null;
        }

        if (! $response->ok()) {
            return null;
        }

        $content = $response->json('choices.0.message.content');
        if (! is_string($content) || trim($content) === '') {
            return null;
        }

        $decoded = json_decode(trim($content), true);
        if (! is_array($decoded)) {
            return null;
        }

        $summary = trim((string) ($decoded['summary'] ?? ''));
        $place = trim((string) ($decoded['place'] ?? ''));
        if ($summary === '' || $place === '') {
            return null;
        }

        return ['summary' => $summary, 'place' => $place];
    }
}

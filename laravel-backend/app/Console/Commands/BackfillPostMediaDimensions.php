<?php

namespace App\Console\Commands;

use App\Support\VideoDimensions;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * One-shot backfill for the media dimension columns added by
 * 2026_09_30_000005_add_media_dimensions_to_posts_table.
 *
 * Rows created before that migration have NULL width/height, which makes the React Native
 * client fall back to RATIO_FALLBACK (1:1) and renders every legacy landscape clip inside a
 * square box. This reads each post's real intrinsic size back out of the stored file.
 *
 * Scope notes, all deliberate:
 *
 *   - Text-only posts are SKIPPED and left NULL. They have no media box in the feed, so a
 *     dimension would be meaningless, and a bogus value would be worse than NULL.
 *   - Soft-deleted posts ARE processed. They are excluded from the feed today but can be
 *     restored, and re-reading 6 rows is cheaper than discovering the gap after a restore.
 *   - Rows that already have both dimensions are SKIPPED, so the command is idempotent and
 *     safe to re-run after new uploads land.
 *   - Per-media-item dimensions are also written into the media_items JSON, because the
 *     carousel reads mediaItems[i].width/height while the post-level columns only describe
 *     the first item.
 *
 * Usage:
 *   php artisan posts:backfill-media-dimensions --dry-run
 *   php artisan posts:backfill-media-dimensions
 */
class BackfillPostMediaDimensions extends Command
{
    protected $signature = 'posts:backfill-media-dimensions
                            {--dry-run : Report what would change without writing}';

    protected $description = 'Populate posts.width/height/aspect_ratio from the stored media files';

    /** Rows per DB chunk. Keeps memory flat regardless of table size. */
    private const CHUNK = 200;

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $counts = [
            'updated' => 0,
            'already_set' => 0,
            'text_only' => 0,
            'file_missing' => 0,
            'unparsable' => 0,
            'items_annotated' => 0,
        ];

        $problems = [];

        DB::table('posts')
            ->select(['id', 'media_url', 'media_items', 'media_type', 'width', 'height'])
            ->orderBy('id')
            ->chunkById(self::CHUNK, function ($posts) use (&$counts, &$problems, $dryRun) {
                foreach ($posts as $post) {
                    $items = $this->decodeItems($post->media_items);

                    // A post with no media_url and no media_items is a text-only post.
                    if (! $post->media_url && $items === []) {
                        $counts['text_only']++;

                        continue;
                    }

                    // Already backfilled -- leave it alone so re-runs are no-ops.
                    if ($post->width !== null && $post->height !== null) {
                        $counts['already_set']++;

                        continue;
                    }

                    $primaryUrl = $post->media_url;
                    $fallbackUrl = $items[0]['url'] ?? null;

                    $path = VideoDimensions::localPathForUrl($primaryUrl);
                    if ($path === null) {
                        $path = VideoDimensions::localPathForUrl($fallbackUrl);
                    }

                    if ($path === null) {
                        $counts['file_missing']++;
                        $problems[] = "file missing on disk: {$post->media_url}";

                        continue;
                    }

                    $dimensions = VideoDimensions::inspect($path);

                    if ($dimensions === null) {
                        $counts['unparsable']++;
                        $mediaType = $post->media_type ?? 'unknown';
                        $problems[] = "unparsable media ({$mediaType}): {$post->media_url}";

                        continue;
                    }

                    $annotated = $this->annotateItems($items, $path);
                    $counts['items_annotated'] += $annotated;

                    if ($dryRun) {
                        $counts['updated']++;

                        continue;
                    }

                    DB::table('posts')->where('id', $post->id)->update([
                        'width' => $dimensions['width'],
                        'height' => $dimensions['height'],
                        'aspect_ratio' => round($dimensions['width'] / $dimensions['height'], 6),
                        'media_items' => $annotated > 0
                            ? json_encode($this->mergeItemDimensions($items, $path))
                            : $post->media_items,
                        'updated_at' => now(),
                    ]);

                    $counts['updated']++;
                }
            });

        $this->report($counts, $problems, $dryRun);

        // Missing files and unparsable media are expected on a legacy dataset, not a crash.
        return self::SUCCESS;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function decodeItems(?string $json): array
    {
        if ($json === null || trim($json) === '') {
            return [];
        }

        $decoded = json_decode($json, true);

        return is_array($decoded) ? array_values(array_filter($decoded, 'is_array')) : [];
    }

    /**
     * Add width/height to each media item whose file we can actually read.
     *
     * @param  array<int, array<string, mixed>>  $items
     * @return int number of items annotated
     */
    private function mergeItemDimensions(array $items, string $fallbackPath): array
    {
        $annotated = 0;

        foreach ($items as $index => $item) {
            // The primary item is the one the post-level columns describe, and it may have
            // been stored with a media_url that no longer resolves, so prefer the path we
            // already proved readable for item 0.
            $path = $index === 0
                ? $fallbackPath
                : VideoDimensions::localPathForUrl($item['url'] ?? null);

            if ($path === null) {
                continue;
            }

            $dimensions = VideoDimensions::inspect($path);

            if ($dimensions === null) {
                continue;
            }

            $items[$index]['width'] = $dimensions['width'];
            $items[$index]['height'] = $dimensions['height'];
            $annotated++;
        }

        return $items;
    }

    /**
     * Re-parse media_items to count annotations without mutating the input twice.
     *
     * @param  array<int, array<string, mixed>>  $items
     */
    private function annotateItems(array $items, string $fallbackPath): int
    {
        return count($this->mergeItemDimensions($items, $fallbackPath));
    }

    /**
     * @param  array<string, int>  $counts
     * @param  array<int, string>  $problems
     */
    private function report(array $counts, array $problems, bool $dryRun): void
    {
        $this->newLine();
        $this->line($dryRun
            ? '  DRY RUN -- nothing was written.'
            : '  Media dimension backfill complete.');

        $rows = [
            ['updated (rows with dimensions written)', $counts['updated']],
            ['already had dimensions (skipped)', $counts['already_set']],
            ['text-only posts (no media, left NULL)', $counts['text_only']],
            ['media file missing on disk (left NULL)', $counts['file_missing']],
            ['media unparsable (left NULL)', $counts['unparsable']],
        ];

        $this->table(['result', 'rows'], $rows);

        if ($counts['items_annotated'] > 0) {
            $this->line("  media_items entries annotated with width/height: {$counts['items_annotated']}");
        }

        if ($problems !== []) {
            $this->newLine();
            $this->warn('  Rows left NULL and needing manual attention:');

            foreach (array_slice($problems, 0, 20) as $problem) {
                $this->line("    - {$problem}");
            }

            if (count($problems) > 20) {
                $this->line('    ... and '.(count($problems) - 20).' more');
            }
        }

        // Prove the result rather than just asserting it.
        $filled = DB::table('posts')->whereNotNull('width')->whereNotNull('height')->count();
        $nullWithMedia = DB::table('posts')
            ->whereNull('width')
            ->where(fn ($q) => $q->whereNotNull('media_url')->orWhereNotNull('media_items'))
            ->count();

        $this->newLine();
        $this->line("  Verified: {$filled} rows now carry width+height, {$nullWithMedia} media-bearing rows still NULL.");

        if ($nullWithMedia > 0 && ! $dryRun) {
            $this->line('  Those rows fall back to the 1:1 square box until their files are restored.');
        }
    }
}

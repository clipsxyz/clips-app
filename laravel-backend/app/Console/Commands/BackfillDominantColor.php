<?php

namespace App\Console\Commands;

use App\Models\Post;
use App\Services\VideoThumbnailService;
use Illuminate\Console\Command;

/**
 * One-shot backfill for posts.dominant_color, added by
 * 2026_10_02_000001_add_dominant_color_to_posts_table.
 *
 * New posts get a colour the moment their poster is generated (see
 * VideoThumbnailService::ensureDominantColorFor). Rows that predate the column keep NULL,
 * which leaves the feed's ambient canvas pinned to its fallback for those posts -- so the
 * page stops shifting colour partway down the feed.
 *
 * Scope notes, all deliberate and mirroring BackfillPostMediaDimensions:
 *
 *   - Text-only posts are SKIPPED and left NULL. There is no media box to sample, and a
 *     fabricated colour would be worse than none.
 *   - Soft-deleted posts ARE processed. They are hidden from the feed today but can be
 *     restored, and re-reading 6 rows is cheaper than finding the gap after a restore.
 *   - Posts that already have a colour are SKIPPED, so this is idempotent and safe to re-run
 *     after new uploads land.
 *   - Sampling reads the poster JPEG, and falls back to the post's first still image. Both
 *     are local files on the `public` disk, so this performs no network IO on a warm run.
 *
 * Usage:
 *   php artisan posts:backfill-dominant-color --dry-run
 *   php artisan posts:backfill-dominant-color
 */
class BackfillDominantColor extends Command
{
    protected $signature = 'posts:backfill-dominant-color
                            {--dry-run : Report what would change without writing}';

    protected $description = 'Sample posts.dominant_color from the stored poster / first still image';

    /** Rows per DB chunk. Keeps memory flat regardless of table size. */
    private const CHUNK = 200;

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $thumbnails = app(VideoThumbnailService::class);

        $scanned = 0;
        $filled = 0;
        $skipped = 0;
        $failed = 0;

        $query = Post::query()
            // withTrashed(): soft-deleted posts are excluded from the feed today but can be
            // restored, and the query builder used by BackfillPostMediaDimensions already
            // reaches them. Matching that keeps the two backfills consistent.
            ->withTrashed()
            ->whereNull('dominant_color')
            // Text-only posts have nothing to sample.
            ->where(function ($q) {
                $q->whereNotNull('media_url')->orWhereNotNull('media_items');
            })
            ->orderBy('id');

        $query->chunkById(self::CHUNK, function ($posts) use (&$scanned, &$filled, &$skipped, &$failed, $dryRun, $thumbnails) {
            foreach ($posts as $post) {
                $scanned++;

                if (trim((string) $post->dominant_color) !== '') {
                    $skipped++;
                    continue;
                }

                // Dry-run resolves the colour WITHOUT writing. It must not call
                // ensureDominantColorFor: that method saves internally, so the "preview"
                // would silently be a real migration of every row it touched.
                $hex = $dryRun
                    ? $thumbnails->sampleDominantColorFor($post)
                    : tap($thumbnails->sampleDominantColorFor($post), function ($sampled) use ($post) {
                        if ($sampled !== null) {
                            $post->dominant_color = $sampled;
                            $post->save();
                        }
                    });

                if ($hex === null) {
                    $failed++;
                    continue;
                }

                $filled++;
                if ($dryRun) {
                    $this->line(sprintf(
                        '  would set %s -> %s',
                        substr((string) $post->id, 0, 8),
                        $hex,
                    ));
                }
            }
        });

        $this->newLine();
        $this->info(sprintf(
            '%s scanned=%d filled=%d skipped=%d unresolved=%d',
            $dryRun ? '[dry-run]' : '[done]',
            $scanned,
            $filled,
            $skipped,
            $failed,
        ));

        if (! $dryRun && $filled > 0) {
            $this->comment('Note: the API response is cached per-feed-request; restart the queue worker if colors are not reflected.');
        }

        return self::SUCCESS;
    }
}
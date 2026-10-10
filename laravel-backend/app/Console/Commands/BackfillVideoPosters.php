<?php

namespace App\Console\Commands;

use App\Models\Post;
use App\Services\VideoThumbnailService;
use Illuminate\Console\Command;

/**
 * One-shot backfill for video posters that are missing or that decode to a (near) uniformly
 * black frame — the tell-tale of a poster captured from a clip's black leader.
 *
 * The feed paints a black tile whenever a slide's poster is black, and multi-video carousels
 * make this worse because each slide carries its own poster. ensureForPost() now repairs the
 * per-slide poster too, but posts rendered before that fix still hold the black JPEG, so this
 * command walks the existing rows and regenerates them from the clip itself.
 *
 * Scope notes, mirroring BackfillDominantColor:
 *
 *   - Text-only posts are SKIPPED; there is no video to sample.
 *   - Soft-deleted posts ARE processed (they can be restored).
 *   - Posts whose every video poster is already visible are SKIPPED, so this is idempotent.
 *   - Requires ffmpeg on the PATH of the PHP process; posts are left untouched if it is absent.
 */
class BackfillVideoPosters extends Command
{
    protected $signature = 'posts:backfill-video-posters
        {--dry-run : Report which posts would be regenerated without writing}';

    protected $description = 'Regenerate missing/black video posters, including per carousel slide';

    private const CHUNK = 100;

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $thumbnails = app(VideoThumbnailService::class);

        $scanned = 0;
        $repaired = 0;
        $skipped = 0;

        $query = Post::query()
            ->withTrashed()
            ->where(function ($q) {
                $q->where('media_type', 'video')
                    ->orWhereNotNull('media_items')
                    ->orWhereNotNull('final_video_url');
            })
            ->orderBy('id');

        $query->chunkById(self::CHUNK, function ($posts) use (&$scanned, &$repaired, &$skipped, $dryRun, $thumbnails) {
            foreach ($posts as $post) {
                $scanned++;

                if (! $thumbnails->posterNeedsRepair($post)) {
                    $skipped++;
                    continue;
                }

                $repaired++;
                if ($dryRun) {
                    $this->line(sprintf('  would regenerate %s', substr((string) $post->id, 0, 8)));
                    continue;
                }

                $thumbnails->ensureForPost($post);
            }
        });

        $this->newLine();
        $this->info(sprintf(
            '%s scanned=%d regenerated=%d skipped=%d',
            $dryRun ? '[dry-run]' : '[done]',
            $scanned,
            $repaired,
            $skipped,
        ));

        return self::SUCCESS;
    }
}

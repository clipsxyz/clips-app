<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Stores where a boost's radius was measured from.
 *
 * A boost is scoped by "within radiusKm of <center>", but only the free-text
 * center_local label was persisted, and only on the /boost/activate path — the
 * Stripe webhook (the authoritative activation route) always wrote NULL. With no
 * center there is nothing to measure viewer distance against, so radius
 * eligibility could never be enforced.
 *
 * Coordinates are resolved once at activation from the booster's own user record
 * and frozen here, so eligibility does not depend on re-resolving a label later
 * (or on the centroid seed table changing underneath us).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('boosts', 'center_lat')) {
            Schema::table('boosts', function (Blueprint $table) {
                $table->decimal('center_lat', 10, 7)->nullable()->after('center_local');
                $table->decimal('center_lng', 10, 7)->nullable()->after('center_lat');
            });
        }

        $this->backfill();
    }

    public function down(): void
    {
        if (!Schema::hasColumn('boosts', 'center_lat')) {
            return;
        }

        Schema::table('boosts', function (Blueprint $table) {
            $table->dropColumn(['center_lat', 'center_lng']);
        });
    }

    /**
     * Best-effort: resolve existing center_local labels via the centroid seed
     * table. Rows that cannot be resolved stay NULL and fall back to a live
     * resolve at read time.
     */
    private function backfill(): void
    {
        if (!Schema::hasTable('location_centroids')) {
            return;
        }

        DB::table('boosts')
            ->whereNotNull('center_local')
            ->whereNull('center_lat')
            ->orderBy('id')
            ->chunk(200, function ($boosts): void {
                $labels = $boosts->pluck('center_local')->filter()->unique()->values();
                if ($labels->isEmpty()) {
                    return;
                }

                $centroids = DB::table('location_centroids')
                    ->whereIn('label', $labels)
                    ->get(['label', 'latitude', 'longitude'])
                    ->keyBy('label');

                foreach ($boosts as $boost) {
                    $row = $centroids->get($boost->center_local);
                    if (!$row) {
                        continue;
                    }
                    DB::table('boosts')
                        ->where('id', $boost->id)
                        ->update([
                            'center_lat' => (float) $row->latitude,
                            'center_lng' => (float) $row->longitude,
                        ]);
                }
            });
    }
};

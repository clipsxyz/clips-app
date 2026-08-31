<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('location_centroids') && ! Schema::hasColumn('location_centroids', 'place_id')) {
            Schema::table('location_centroids', function (Blueprint $table) {
                $table->string('place_id', 255)->nullable()->after('label');
                $table->unique('place_id');
            });
        }

        if (Schema::hasTable('posts')) {
            Schema::table('posts', function (Blueprint $table) {
                if (! Schema::hasColumn('posts', 'place_id')) {
                    $table->string('place_id', 255)->nullable()->after('location_label');
                }
                if (! Schema::hasColumn('posts', 'latitude')) {
                    $table->decimal('latitude', 10, 7)->nullable()->after('place_id');
                }
                if (! Schema::hasColumn('posts', 'longitude')) {
                    $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
                }
            });

            Schema::table('posts', function (Blueprint $table) {
                if (Schema::hasColumn('posts', 'place_id')) {
                    $table->index('place_id');
                }
                if (Schema::hasColumn('posts', 'latitude') && Schema::hasColumn('posts', 'longitude')) {
                    $table->index(['latitude', 'longitude']);
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('posts')) {
            Schema::table('posts', function (Blueprint $table) {
                if (Schema::hasColumn('posts', 'longitude')) {
                    $table->dropColumn('longitude');
                }
                if (Schema::hasColumn('posts', 'latitude')) {
                    $table->dropColumn('latitude');
                }
                if (Schema::hasColumn('posts', 'place_id')) {
                    $table->dropColumn('place_id');
                }
            });
        }

        if (Schema::hasTable('location_centroids') && Schema::hasColumn('location_centroids', 'place_id')) {
            Schema::table('location_centroids', function (Blueprint $table) {
                $table->dropUnique(['place_id']);
                $table->dropColumn('place_id');
            });
        }
    }
};

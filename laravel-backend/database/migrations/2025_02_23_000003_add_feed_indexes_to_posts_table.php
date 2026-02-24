<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add extra indexes that help common feed queries.
     *
     * This is safe to ship while you're still using mocks on the frontend:
     * it only affects how the database searches when you start hitting
     * the real Laravel endpoints more heavily later.
     */
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            // For location feeds: WHERE location_label LIKE '%X%' ORDER BY created_at DESC
            // We already have separate indexes on location_label and created_at;
            // this composite index helps databases that can use the prefix for sorting.
            $table->index(['location_label', 'created_at'], 'posts_location_created_at_index');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropIndex('posts_location_created_at_index');
        });
    }
};


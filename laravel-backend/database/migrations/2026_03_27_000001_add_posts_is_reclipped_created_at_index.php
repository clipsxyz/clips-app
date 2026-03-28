<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Speeds suggested-by-places candidate scan: notReclipped() + orderBy created_at desc + limit.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->index(
                ['is_reclipped', 'created_at'],
                'posts_is_reclipped_created_at_index'
            );
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropIndex('posts_is_reclipped_created_at_index');
        });
    }
};

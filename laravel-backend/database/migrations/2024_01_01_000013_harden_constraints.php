<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Enforce one share per user per post
        Schema::table('post_shares', function (Blueprint $table) {
            $table->unique(['user_id', 'post_id'], 'post_shares_user_post_unique');
        });

        // Prevent negative counters (best-effort, supported on PG and MySQL 8+)
        // Posts counters
        try {
            DB::statement("ALTER TABLE posts ADD CONSTRAINT posts_non_negative_counters CHECK (
                likes_count >= 0 AND views_count >= 0 AND comments_count >= 0 AND shares_count >= 0 AND reclips_count >= 0
            )");
        } catch (Throwable $e) {
            // Ignore if constraint already exists or not supported
        }

        // Comments counters
        try {
            DB::statement("ALTER TABLE comments ADD CONSTRAINT comments_non_negative_counters CHECK (
                likes_count >= 0 AND replies_count >= 0
            )");
        } catch (Throwable $e) {
            // Ignore if constraint already exists or not supported
        }
    }

    public function down(): void
    {
        // Drop unique on shares
        Schema::table('post_shares', function (Blueprint $table) {
            $table->dropUnique('post_shares_user_post_unique');
        });

        // Drop check constraints if supported (best-effort)
        try { DB::statement('ALTER TABLE posts DROP CONSTRAINT posts_non_negative_counters'); } catch (Throwable $e) {}
        try { DB::statement('ALTER TABLE comments DROP CONSTRAINT comments_non_negative_counters'); } catch (Throwable $e) {}
    }
};



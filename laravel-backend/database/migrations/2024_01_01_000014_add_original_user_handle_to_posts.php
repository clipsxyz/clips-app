<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            if (!Schema::hasColumn('posts', 'original_user_handle')) {
                $table->string('original_user_handle', 100)->nullable()->after('original_post_id');
                $table->index('original_user_handle');
            }
        });

        // Update existing reclipped posts with original user handle
        // This will run after the column is added
        $reclippedPosts = DB::table('posts')
            ->where('is_reclipped', true)
            ->whereNull('original_user_handle')
            ->whereNotNull('original_post_id')
            ->get();

        foreach ($reclippedPosts as $reclippedPost) {
            $originalPost = DB::table('posts')
                ->where('id', $reclippedPost->original_post_id)
                ->first();

            if ($originalPost) {
                DB::table('posts')
                    ->where('id', $reclippedPost->id)
                    ->update(['original_user_handle' => $originalPost->user_handle]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            if (Schema::hasColumn('posts', 'original_user_handle')) {
                $table->dropIndex(['original_user_handle']);
                $table->dropColumn('original_user_handle');
            }
        });
    }
};


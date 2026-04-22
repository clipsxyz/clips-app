<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->index(['created_at', 'id'], 'posts_created_at_id_idx');
            $table->index(['is_reclipped', 'location_label', 'created_at', 'id'], 'posts_feed_location_cursor_idx');
        });

        Schema::table('user_follows', function (Blueprint $table) {
            $table->index(['following_id', 'follower_id', 'status'], 'user_follows_following_follower_status_idx');
            $table->index(['follower_id', 'following_id', 'status'], 'user_follows_follower_following_status_idx');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropIndex('posts_created_at_id_idx');
            $table->dropIndex('posts_feed_location_cursor_idx');
        });

        Schema::table('user_follows', function (Blueprint $table) {
            $table->dropIndex('user_follows_following_follower_status_idx');
            $table->dropIndex('user_follows_follower_following_status_idx');
        });
    }
};


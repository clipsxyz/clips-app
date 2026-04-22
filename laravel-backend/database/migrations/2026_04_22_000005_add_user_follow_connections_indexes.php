<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_follows', function (Blueprint $table) {
            $table->index(['following_id', 'status', 'created_at', 'follower_id'], 'user_follows_followers_cursor_idx');
            $table->index(['follower_id', 'status', 'created_at', 'following_id'], 'user_follows_following_cursor_idx');
        });
    }

    public function down(): void
    {
        Schema::table('user_follows', function (Blueprint $table) {
            $table->dropIndex('user_follows_followers_cursor_idx');
            $table->dropIndex('user_follows_following_cursor_idx');
        });
    }
};


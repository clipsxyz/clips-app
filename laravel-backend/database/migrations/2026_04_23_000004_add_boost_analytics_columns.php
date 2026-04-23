<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('boosts', function (Blueprint $table) {
            $table->unsignedBigInteger('impressions_count')->default(0)->after('duration_hours');
            $table->unsignedBigInteger('likes_count')->default(0)->after('impressions_count');
            $table->unsignedBigInteger('comments_count')->default(0)->after('likes_count');
            $table->unsignedBigInteger('shares_count')->default(0)->after('comments_count');
            $table->timestamp('last_analytics_event_at')->nullable()->after('shares_count');
        });
    }

    public function down(): void
    {
        Schema::table('boosts', function (Blueprint $table) {
            $table->dropColumn([
                'impressions_count',
                'likes_count',
                'comments_count',
                'shares_count',
                'last_analytics_event_at',
            ]);
        });
    }
};


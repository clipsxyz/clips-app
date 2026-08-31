<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->enum('moderation_status', ['approved', 'pending_review', 'hidden'])
                ->default('approved')
                ->after('replies_count');
            $table->boolean('is_hidden')->default(false)->after('moderation_status');
            $table->json('flagged_keywords')->nullable()->after('is_hidden');

            $table->index(['is_hidden', 'moderation_status']);
        });
    }

    public function down(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->dropIndex(['is_hidden', 'moderation_status']);
            $table->dropColumn(['moderation_status', 'is_hidden', 'flagged_keywords']);
        });
    }
};

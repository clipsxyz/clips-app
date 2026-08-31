<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_notification_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->boolean('enabled')->default(true);
            $table->boolean('direct_messages')->default(true);
            $table->boolean('group_chats')->default(true);
            $table->boolean('likes')->default(true);
            $table->boolean('comments')->default(true);
            $table->boolean('replies')->default(true);
            $table->boolean('follows')->default(true);
            $table->boolean('follow_requests')->default(true);
            $table->boolean('story_insights')->default(true);
            $table->boolean('questions')->default(true);
            $table->boolean('shares')->default(true);
            $table->boolean('reclips')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_notification_settings');
    }
};

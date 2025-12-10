<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('render_jobs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade');
            $table->foreignUuid('post_id')->constrained()->onDelete('cascade');
            $table->string('status')->default('queued'); // queued, generating_music, rendering, completed, failed
            $table->json('edit_timeline'); // Edit timeline with clips, trims, transitions, etc.
            $table->json('ai_music_config')->nullable(); // AI music configuration if enabled
            $table->string('video_source_url'); // Original video URL
            $table->string('music_url')->nullable(); // Generated music URL (if AI music used)
            $table->string('final_video_url')->nullable(); // Final rendered video URL
            $table->text('error_message')->nullable(); // Error message if job failed
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['post_id']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('render_jobs');
    }
};

















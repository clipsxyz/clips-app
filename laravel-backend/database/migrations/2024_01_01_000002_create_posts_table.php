<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade');
            $table->string('user_handle', 100);
            $table->text('text_content')->nullable();
            $table->string('media_url', 500)->nullable();
            $table->string('media_type', 20)->nullable();
            $table->string('location_label', 200)->nullable();
            $table->json('tags')->nullable();
            $table->integer('likes_count')->default(0);
            $table->integer('views_count')->default(0);
            $table->integer('comments_count')->default(0);
            $table->integer('shares_count')->default(0);
            $table->integer('reclips_count')->default(0);
            $table->boolean('is_reclipped')->default(false);
            $table->foreignUuid('original_post_id')->nullable()->constrained('posts')->onDelete('cascade');
            $table->string('reclipped_by', 100)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['location_label']);
            $table->index(['created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};


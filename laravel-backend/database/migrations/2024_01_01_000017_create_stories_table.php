<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade');
            $table->string('user_handle', 100);
            $table->string('media_url', 500);
            $table->string('media_type', 20); // 'image' or 'video'
            $table->text('text')->nullable();
            $table->string('text_color', 50)->nullable();
            $table->string('text_size', 20)->nullable(); // 'small', 'medium', 'large'
            $table->string('location', 200)->nullable();
            $table->integer('views_count')->default(0);
            $table->timestamp('expires_at');
            $table->foreignUuid('shared_from_post_id')->nullable()->constrained('posts')->onDelete('set null');
            $table->string('shared_from_user_handle', 100)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['expires_at']);
            $table->index(['user_handle', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stories');
    }
};


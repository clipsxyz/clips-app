<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('post_id')->constrained()->onDelete('cascade');
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade');
            $table->string('user_handle', 100);
            $table->text('text_content');
            $table->foreignUuid('parent_id')->nullable()->constrained('comments')->onDelete('cascade');
            $table->integer('likes_count')->default(0);
            $table->integer('replies_count')->default(0);
            $table->timestamps();

            $table->index(['post_id', 'created_at']);
            $table->index(['parent_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comments');
    }
};


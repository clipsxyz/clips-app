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
        Schema::create('collection_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('collection_id')->constrained('collections')->onDelete('cascade');
            $table->foreignUuid('post_id')->constrained('posts')->onDelete('cascade');
            $table->timestamps();

            // Unique constraint to prevent duplicate posts in same collection
            $table->unique(['collection_id', 'post_id']);

            // Indexes
            $table->index('collection_id');
            $table->index('post_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('collection_posts');
    }
};


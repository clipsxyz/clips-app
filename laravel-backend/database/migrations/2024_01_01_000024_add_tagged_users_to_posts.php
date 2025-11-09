<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Create pivot table for tagged users in posts
        Schema::create('post_tagged_users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('post_id')->constrained('posts')->onDelete('cascade');
            $table->foreignUuid('user_id')->constrained('users')->onDelete('cascade');
            $table->string('user_handle', 100); // Denormalized for quick access
            $table->timestamps();

            // Ensure a user can only be tagged once per post
            $table->unique(['post_id', 'user_id']);
            
            // Indexes for performance
            $table->index('post_id');
            $table->index('user_id');
            $table->index('user_handle');
        });

        // Add text_style column to posts table for text-only posts
        Schema::table('posts', function (Blueprint $table) {
            $table->json('text_style')->nullable()->after('image_text');
            // text_style structure: { "color": "#FFFFFF", "size": "medium", "background": "gradient-1" }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_tagged_users');
        
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('text_style');
        });
    }
};


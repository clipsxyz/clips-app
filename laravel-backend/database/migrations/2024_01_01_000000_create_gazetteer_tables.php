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
        // Users table
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('username', 50)->unique();
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->string('display_name', 100);
            $table->string('handle', 100)->unique();
            $table->text('bio')->nullable();
            $table->string('avatar_url', 500)->nullable();
            $table->string('location_local', 100)->nullable();
            $table->string('location_regional', 100)->nullable();
            $table->string('location_national', 100)->nullable();
            $table->boolean('is_verified')->default(false);
            $table->integer('followers_count')->default(0);
            $table->integer('following_count')->default(0);
            $table->integer('posts_count')->default(0);
            $table->rememberToken();
            $table->timestamps();
        });

        // Posts table
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

        // Comments table
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

        // User interactions tables
        Schema::create('post_likes', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade');
            $table->foreignUuid('post_id')->constrained()->onDelete('cascade');
            $table->timestamps();

            $table->unique(['user_id', 'post_id']);
            $table->index(['user_id', 'post_id']);
        });

        Schema::create('comment_likes', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade');
            $table->foreignUuid('comment_id')->constrained()->onDelete('cascade');
            $table->timestamps();

            $table->unique(['user_id', 'comment_id']);
            $table->index(['user_id', 'comment_id']);
        });

        Schema::create('post_bookmarks', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade');
            $table->foreignUuid('post_id')->constrained()->onDelete('cascade');
            $table->timestamps();

            $table->unique(['user_id', 'post_id']);
            $table->index(['user_id', 'post_id']);
        });

        Schema::create('user_follows', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('follower_id')->constrained('users')->onDelete('cascade');
            $table->foreignUuid('following_id')->constrained('users')->onDelete('cascade');
            $table->timestamps();

            $table->unique(['follower_id', 'following_id']);
            $table->index(['follower_id']);
            $table->index(['following_id']);
        });

        Schema::create('post_shares', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade');
            $table->foreignUuid('post_id')->constrained()->onDelete('cascade');
            $table->timestamps();

            $table->index(['user_id', 'post_id']);
        });

        Schema::create('post_views', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade');
            $table->foreignUuid('post_id')->constrained()->onDelete('cascade');
            $table->timestamps();

            $table->unique(['user_id', 'post_id']);
            $table->index(['user_id', 'post_id']);
        });

        Schema::create('post_reclips', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade');
            $table->foreignUuid('post_id')->constrained()->onDelete('cascade');
            $table->string('user_handle', 100);
            $table->timestamps();

            $table->unique(['user_id', 'post_id']);
            $table->index(['user_id', 'post_id']);
        });

        // Offline queue table
        Schema::create('offline_queue', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade');
            $table->string('action_type', 50);
            $table->foreignUuid('post_id')->nullable()->constrained()->onDelete('cascade');
            $table->foreignUuid('comment_id')->nullable()->constrained()->onDelete('cascade');
            $table->foreignUuid('parent_id')->nullable()->constrained('comments')->onDelete('cascade');
            $table->text('text_content')->nullable();
            $table->string('user_handle', 100)->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->string('status', 20)->default('pending');
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });

        // Feed cache table
        Schema::create('feed_cache', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade');
            $table->string('filter_type', 50);
            $table->json('cached_data');
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->unique(['user_id', 'filter_type']);
            $table->index(['user_id', 'filter_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('feed_cache');
        Schema::dropIfExists('offline_queue');
        Schema::dropIfExists('post_reclips');
        Schema::dropIfExists('post_views');
        Schema::dropIfExists('post_shares');
        Schema::dropIfExists('user_follows');
        Schema::dropIfExists('post_bookmarks');
        Schema::dropIfExists('comment_likes');
        Schema::dropIfExists('post_likes');
        Schema::dropIfExists('comments');
        Schema::dropIfExists('posts');
        Schema::dropIfExists('users');
    }
};

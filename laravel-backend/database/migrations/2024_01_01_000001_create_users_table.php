<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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
            $table->json('social_links')->nullable();
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
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};


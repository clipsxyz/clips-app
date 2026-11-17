<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('profile_post_subscriptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('subscriber_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('creator_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['subscriber_id', 'creator_id']);
            $table->index('creator_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('profile_post_subscriptions');
    }
};

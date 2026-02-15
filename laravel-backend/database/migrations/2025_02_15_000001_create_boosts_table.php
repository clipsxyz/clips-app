<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boosts', function (Blueprint $table) {
            $table->id();
            $table->uuid('post_id');
            $table->foreign('post_id')->references('id')->on('posts')->onDelete('cascade');
            $table->uuid('user_id');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->enum('feed_type', ['local', 'regional', 'national']);
            $table->decimal('price', 10, 2);
            $table->string('payment_intent_id')->nullable()->index();
            $table->timestamp('activated_at');
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index(['post_id', 'feed_type']);
            $table->index(['expires_at']);
            $table->index(['feed_type', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('boosts');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_follows', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('follower_id')->constrained('users')->onDelete('cascade');
            $table->foreignUuid('following_id')->constrained('users')->onDelete('cascade');
            $table->timestamps();

            $table->unique(['follower_id', 'following_id']);
            $table->index(['follower_id']);
            $table->index(['following_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_follows');
    }
};


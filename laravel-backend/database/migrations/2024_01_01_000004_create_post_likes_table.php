<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_likes', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade');
            $table->foreignUuid('post_id')->constrained()->onDelete('cascade');
            $table->timestamps();

            $table->unique(['user_id', 'post_id']);
            $table->index(['user_id', 'post_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_likes');
    }
};


<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('story_reactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('story_id')->constrained()->onDelete('cascade');
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade');
            $table->string('user_handle', 100);
            $table->string('emoji', 10); // emoji reaction
            $table->timestamps();

            $table->unique(['story_id', 'user_id']); // One reaction per user per story
            $table->index(['story_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('story_reactions');
    }
};



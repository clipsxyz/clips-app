<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('story_replies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('story_id')->constrained()->onDelete('cascade');
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade');
            $table->string('user_handle', 100);
            $table->text('text');
            $table->timestamps();

            $table->index(['story_id', 'created_at']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('story_replies');
    }
};



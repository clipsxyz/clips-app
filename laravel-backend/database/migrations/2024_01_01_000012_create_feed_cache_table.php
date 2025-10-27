<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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

    public function down(): void
    {
        Schema::dropIfExists('feed_cache');
    }
};


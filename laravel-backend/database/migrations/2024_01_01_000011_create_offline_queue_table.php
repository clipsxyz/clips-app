<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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
    }

    public function down(): void
    {
        Schema::dropIfExists('offline_queue');
    }
};


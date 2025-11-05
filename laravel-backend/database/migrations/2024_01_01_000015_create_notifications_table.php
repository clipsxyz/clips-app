<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->onDelete('cascade'); // recipient
            $table->string('type', 50); // 'sticker', 'reply', 'dm', 'like', 'comment', 'follow'
            $table->string('from_handle', 100); // sender's handle
            $table->string('to_handle', 100); // recipient's handle
            $table->text('message')->nullable();
            $table->foreignUuid('post_id')->nullable()->constrained()->onDelete('cascade');
            $table->foreignUuid('comment_id')->nullable()->constrained()->onDelete('cascade');
            $table->boolean('read')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'read']);
            $table->index(['user_id', 'created_at']);
            $table->index(['to_handle', 'read']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};


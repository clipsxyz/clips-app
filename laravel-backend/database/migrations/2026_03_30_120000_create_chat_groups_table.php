<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_groups', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 120);
            $table->foreignUuid('creator_id')->constrained('users')->onDelete('cascade');
            /** Stable thread id for messages list: "grp:{id}" */
            $table->string('conversation_id', 80)->unique();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();

            $table->index(['creator_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_groups');
    }
};

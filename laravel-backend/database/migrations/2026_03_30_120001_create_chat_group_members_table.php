<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_group_members', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('chat_group_id')->constrained('chat_groups')->onDelete('cascade');
            $table->foreignUuid('user_id')->constrained('users')->onDelete('cascade');
            $table->string('role', 20)->default('member'); // admin | member
            $table->timestamp('last_read_at')->nullable();
            $table->timestamp('left_at')->nullable();
            $table->timestamps();

            $table->unique(['chat_group_id', 'user_id']);
            $table->index(['user_id', 'left_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_group_members');
    }
};

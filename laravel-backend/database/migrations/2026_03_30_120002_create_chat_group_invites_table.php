<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_group_invites', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('chat_group_id')->constrained('chat_groups')->onDelete('cascade');
            $table->foreignUuid('inviter_id')->constrained('users')->onDelete('cascade');
            $table->foreignUuid('invitee_id')->constrained('users')->onDelete('cascade');
            $table->string('status', 20)->default('pending'); // pending | accepted | declined | cancelled | expired
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['invitee_id', 'status']);
            $table->index(['chat_group_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_group_invites');
    }
};

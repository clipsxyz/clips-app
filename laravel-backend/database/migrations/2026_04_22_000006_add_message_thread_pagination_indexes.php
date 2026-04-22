<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->index(['conversation_id', 'chat_group_id', 'created_at', 'id'], 'messages_thread_cursor_idx');
            $table->index(['chat_group_id', 'created_at', 'id'], 'messages_group_thread_cursor_idx');
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex('messages_thread_cursor_idx');
            $table->dropIndex('messages_group_thread_cursor_idx');
        });
    }
};


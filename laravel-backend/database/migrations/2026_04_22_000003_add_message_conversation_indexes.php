<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->index(['chat_group_id', 'created_at'], 'messages_group_created_at_idx');
            $table->index(['conversation_id', 'chat_group_id', 'created_at'], 'messages_dm_group_created_at_idx');
            $table->index(['recipient_handle', 'is_system_message', 'read_at', 'created_at'], 'messages_unread_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex('messages_group_created_at_idx');
            $table->dropIndex('messages_dm_group_created_at_idx');
            $table->dropIndex('messages_unread_lookup_idx');
        });
    }
};


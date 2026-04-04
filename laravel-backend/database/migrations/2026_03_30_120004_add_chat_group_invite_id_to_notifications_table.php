<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignUuid('chat_group_invite_id')
                ->nullable()
                ->after('comment_id')
                ->constrained('chat_group_invites')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropForeign(['chat_group_invite_id']);
            $table->dropColumn('chat_group_invite_id');
        });
    }
};

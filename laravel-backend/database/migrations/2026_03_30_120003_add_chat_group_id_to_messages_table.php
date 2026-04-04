<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->foreignUuid('chat_group_id')
                ->nullable()
                ->after('conversation_id')
                ->constrained('chat_groups')
                ->nullOnDelete();
            $table->string('recipient_handle', 100)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropForeign(['chat_group_id']);
            $table->dropColumn('chat_group_id');
            $table->string('recipient_handle', 100)->nullable(false)->change();
        });
    }
};

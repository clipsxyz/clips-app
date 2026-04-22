<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->index(['user_id', 'created_at', 'id'], 'notifications_user_created_id_idx');
            $table->index(['user_id', 'read', 'created_at'], 'notifications_user_read_created_idx');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('notifications_user_created_id_idx');
            $table->dropIndex('notifications_user_read_created_idx');
        });
    }
};


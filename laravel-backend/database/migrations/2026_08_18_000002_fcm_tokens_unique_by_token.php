<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('fcm_tokens')) {
            return;
        }

        Schema::table('fcm_tokens', function (Blueprint $table) {
            // Allow multiple devices per user; token is the unique device identity.
            try {
                $table->dropUnique(['user_id', 'user_handle']);
            } catch (\Throwable $_) {
                // Index name may differ across drivers.
            }
        });

        Schema::table('fcm_tokens', function (Blueprint $table) {
            $table->unique('token');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('fcm_tokens')) {
            return;
        }

        Schema::table('fcm_tokens', function (Blueprint $table) {
            try {
                $table->dropUnique(['token']);
            } catch (\Throwable $_) {
            }
        });

        Schema::table('fcm_tokens', function (Blueprint $table) {
            $table->unique(['user_id', 'user_handle']);
        });
    }
};

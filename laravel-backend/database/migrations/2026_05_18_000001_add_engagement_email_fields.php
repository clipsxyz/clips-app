<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('last_active_at')->nullable()->after('remember_token');
            $table->boolean('email_digest_enabled')->default(true)->after('last_active_at');
        });

        Schema::create('engagement_email_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 50); // inactive_digest
            $table->json('payload')->nullable();
            $table->timestamp('sent_at');

            $table->index(['user_id', 'type', 'sent_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engagement_email_logs');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['last_active_at', 'email_digest_enabled']);
        });
    }
};

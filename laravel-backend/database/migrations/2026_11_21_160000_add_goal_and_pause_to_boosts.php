<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('boosts', function (Blueprint $table) {
            $table->string('goal', 32)->default('views');
            $table->timestamp('paused_at')->nullable();
            $table->unsignedInteger('paused_remaining_seconds')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('boosts', function (Blueprint $table) {
            $table->dropColumn(['goal', 'paused_at', 'paused_remaining_seconds']);
        });
    }
};

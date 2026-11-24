<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('posts', 'scheduled_at')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->timestamp('scheduled_at')->nullable()->index();
            });
        }
        if (! Schema::hasColumn('posts', 'status')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->string('status', 20)->default('published')->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('posts', 'scheduled_at')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->dropColumn('scheduled_at');
            });
        }
        if (Schema::hasColumn('posts', 'status')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->dropColumn('status');
            });
        }
    }
};

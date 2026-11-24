<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('posts', 'source_guid')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->string('source_guid', 255)->nullable()->unique();
            });
        }
        if (! Schema::hasColumn('posts', 'source_url')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->string('source_url', 2048)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('posts', 'source_guid')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->dropUnique(['source_guid']);
                $table->dropColumn('source_guid');
            });
        }
        if (Schema::hasColumn('posts', 'source_url')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->dropColumn('source_url');
            });
        }
    }
};

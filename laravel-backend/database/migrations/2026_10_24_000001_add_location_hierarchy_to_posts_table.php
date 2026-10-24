<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            if (! Schema::hasColumn('posts', 'location_local')) {
                $table->string('location_local', 100)->nullable()->after('location_label');
            }
            if (! Schema::hasColumn('posts', 'location_regional')) {
                $table->string('location_regional', 100)->nullable()->after('location_local');
            }
            if (! Schema::hasColumn('posts', 'location_national')) {
                $table->string('location_national', 100)->nullable()->after('location_regional');
            }
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            foreach (['location_local', 'location_regional', 'location_national'] as $column) {
                if (Schema::hasColumn('posts', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('posts')) {
            return;
        }

        Schema::table('posts', function (Blueprint $table) {
            if (! Schema::hasColumn('posts', 'location_label')) {
                $table->string('location_label', 200)->nullable();
            }
            if (! Schema::hasColumn('posts', 'location_local')) {
                $table->string('location_local', 100)->nullable();
            }
            if (! Schema::hasColumn('posts', 'location_regional')) {
                $table->string('location_regional', 100)->nullable();
            }
            if (! Schema::hasColumn('posts', 'location_national')) {
                $table->string('location_national', 100)->nullable();
            }
            if (! Schema::hasColumn('posts', 'venue')) {
                $table->string('venue', 200)->nullable();
            }
            if (! Schema::hasColumn('posts', 'landmark')) {
                $table->string('landmark', 200)->nullable();
            }
            if (! Schema::hasColumn('posts', 'place_id')) {
                $table->string('place_id', 255)->nullable();
            }
            if (! Schema::hasColumn('posts', 'latitude')) {
                $table->decimal('latitude', 10, 7)->nullable();
            }
            if (! Schema::hasColumn('posts', 'longitude')) {
                $table->decimal('longitude', 10, 7)->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('posts')) {
            return;
        }

        Schema::table('posts', function (Blueprint $table) {
            foreach ([
                'location_local',
                'location_regional',
                'location_national',
            ] as $column) {
                if (Schema::hasColumn('posts', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};

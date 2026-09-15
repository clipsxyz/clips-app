<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $hasAddress = Schema::hasColumn('users', 'business_address');
        $hasLat = Schema::hasColumn('users', 'latitude');
        $hasLng = Schema::hasColumn('users', 'longitude');
        if ($hasAddress && $hasLat && $hasLng) {
            return;
        }

        Schema::table('users', function (Blueprint $table) use ($hasAddress, $hasLat, $hasLng) {
            if (! $hasAddress) {
                $table->string('business_address', 500)->nullable()->after('location_national');
            }
            if (! $hasLat) {
                $table->decimal('latitude', 10, 7)->nullable()->after($hasAddress ? 'business_address' : 'location_national');
            }
            if (! $hasLng) {
                $table->decimal('longitude', 10, 7)->nullable()->after($hasLat ? 'latitude' : ($hasAddress ? 'business_address' : 'location_national'));
            }
        });
    }

    public function down(): void
    {
        $drops = array_values(array_filter(
            ['longitude', 'latitude', 'business_address'],
            fn (string $column) => Schema::hasColumn('users', $column)
        ));
        if ($drops === []) {
            return;
        }

        Schema::table('users', function (Blueprint $table) use ($drops) {
            $table->dropColumn($drops);
        });
    }
};

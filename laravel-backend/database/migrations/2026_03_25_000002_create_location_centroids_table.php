<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('location_centroids', function (Blueprint $table) {
            $table->id();
            $table->string('label')->unique();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->timestamps();
        });

        // Minimal seed for current demo/testing areas.
        // Coordinates are approximate centroids.
        DB::table('location_centroids')->insert([
            [
                'label' => 'Finglas',
                'latitude' => 53.3878000,
                'longitude' => -6.2867000,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'label' => 'Dublin',
                'latitude' => 53.3498000,
                'longitude' => -6.2603000,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'label' => 'Ireland',
                'latitude' => 53.1424000,
                'longitude' => -7.6921000,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('location_centroids');
    }
};


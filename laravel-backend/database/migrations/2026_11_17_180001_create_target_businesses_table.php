<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('target_businesses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('google_place_id')->unique();
            $table->string('name');
            $table->string('category')->nullable();
            $table->string('formatted_address', 500)->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('website', 2048)->nullable();
            $table->string('phone', 64)->nullable();
            $table->string('outreach_status', 32)->default('pending');
            $table->timestamp('cached_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('target_businesses');
    }
};

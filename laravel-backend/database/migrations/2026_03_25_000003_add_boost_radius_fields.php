<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('boosts', function (Blueprint $table) {
            $table->decimal('radius_km', 8, 2)->nullable()->after('feed_type');
            $table->string('center_local')->nullable()->after('radius_km');
            $table->unsignedBigInteger('eligible_users_count')->nullable()->after('center_local');
            $table->unsignedInteger('duration_hours')->nullable()->after('eligible_users_count');
        });
    }

    public function down(): void
    {
        Schema::table('boosts', function (Blueprint $table) {
            $table->dropColumn(['radius_km', 'center_local', 'eligible_users_count', 'duration_hours']);
        });
    }
};


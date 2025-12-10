<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('music', function (Blueprint $table) {
            $table->string('license_type')->nullable()->after('is_active'); // CC0, CC-BY, CC-BY-SA, Public Domain
            $table->string('license_url')->nullable()->after('license_type');
            $table->boolean('license_requires_attribution')->default(false)->after('license_url');
            $table->string('file_path')->nullable()->after('url'); // Local storage path for library tracks
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('music', function (Blueprint $table) {
            $table->dropColumn(['license_type', 'license_url', 'license_requires_attribution', 'file_path']);
        });
    }
};










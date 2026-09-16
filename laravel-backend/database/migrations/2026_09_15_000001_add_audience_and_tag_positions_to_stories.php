<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            if (! Schema::hasColumn('stories', 'audience')) {
                $table->string('audience', 32)->default('public')->after('tagged_users');
                $table->index('audience');
            }
            if (! Schema::hasColumn('stories', 'tagged_users_positions')) {
                $table->json('tagged_users_positions')->nullable()->after('audience');
            }
        });
    }

    public function down(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            if (Schema::hasColumn('stories', 'tagged_users_positions')) {
                $table->dropColumn('tagged_users_positions');
            }
            if (Schema::hasColumn('stories', 'audience')) {
                $table->dropIndex(['audience']);
                $table->dropColumn('audience');
            }
        });
    }
};

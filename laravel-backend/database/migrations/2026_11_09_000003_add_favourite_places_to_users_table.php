<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'favourite_places')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->json('favourite_places')->nullable();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('users', 'favourite_places')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('favourite_places');
        });
    }
};

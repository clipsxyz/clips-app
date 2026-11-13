<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'interests')) {
                $table->json('interests')->nullable();
            }
            if (! Schema::hasColumn('users', 'country_flag')) {
                $table->string('country_flag', 32)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'country_flag')) {
                $table->dropColumn('country_flag');
            }
            if (Schema::hasColumn('users', 'interests')) {
                $table->dropColumn('interests');
            }
        });
    }
};

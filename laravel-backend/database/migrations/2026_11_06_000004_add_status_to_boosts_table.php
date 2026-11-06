<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('boosts', function (Blueprint $table) {
            $table->string('status', 32)->default('pending');
        });

        DB::table('boosts')->whereNotNull('activated_at')->update(['status' => 'active']);
    }

    public function down(): void
    {
        Schema::table('boosts', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};

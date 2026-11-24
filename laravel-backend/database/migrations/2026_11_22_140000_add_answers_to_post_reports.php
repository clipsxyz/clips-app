<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('post_reports', function (Blueprint $table) {
            $table->json('answers')->nullable()->after('details');
            $table->string('status', 32)->default('pending')->after('answers');
        });
    }

    public function down(): void
    {
        Schema::table('post_reports', function (Blueprint $table) {
            $table->dropColumn(['answers', 'status']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            if (! Schema::hasColumn('stories', 'video_poster_url')) {
                $table->string('video_poster_url', 500)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            if (Schema::hasColumn('stories', 'video_poster_url')) {
                $table->dropColumn('video_poster_url');
            }
        });
    }
};

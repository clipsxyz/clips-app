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
        Schema::table('posts', function (Blueprint $table) {
            $table->unsignedBigInteger('music_track_id')->nullable()->after('final_video_url');
            $table->string('music_attribution')->nullable()->after('music_track_id'); // Store attribution text
            
            $table->foreign('music_track_id')->references('id')->on('music')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropForeign(['music_track_id']);
            $table->dropColumn(['music_track_id', 'music_attribution']);
        });
    }
};




















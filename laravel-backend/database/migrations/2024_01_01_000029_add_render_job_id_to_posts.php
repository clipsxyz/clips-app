<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->uuid('render_job_id')->nullable()->after('edit_timeline');
            $table->string('final_video_url')->nullable()->after('render_job_id');
            
            $table->foreign('render_job_id')->references('id')->on('render_jobs')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropForeign(['render_job_id']);
            $table->dropColumn(['render_job_id', 'final_video_url']);
        });
    }
};



























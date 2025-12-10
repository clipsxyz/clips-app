<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            // Video captions feature
            $table->boolean('video_captions_enabled')->default(false)->after('image_text');
            $table->text('video_caption_text')->nullable()->after('video_captions_enabled');
            
            // Video subtitles feature
            $table->boolean('subtitles_enabled')->default(false)->after('video_caption_text');
            $table->text('subtitle_text')->nullable()->after('subtitles_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn([
                'video_captions_enabled',
                'video_caption_text',
                'subtitles_enabled',
                'subtitle_text'
            ]);
        });
    }
};












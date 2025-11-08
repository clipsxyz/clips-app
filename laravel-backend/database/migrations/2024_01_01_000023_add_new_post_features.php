<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            // News ticker banner text
            $table->string('banner_text', 500)->nullable()->after('reclipped_by');
            
            // Stickers applied to the post (JSON array of StickerOverlay objects)
            $table->json('stickers')->nullable()->after('banner_text');
            
            // Template ID used to create the post
            $table->string('template_id', 100)->nullable()->after('stickers');
            
            // Media items for carousel/templates (JSON array of media objects)
            $table->json('media_items')->nullable()->after('template_id');
            
            // Caption for image/video posts
            $table->text('caption')->nullable()->after('text_content');
            
            // Image text overlay
            $table->text('image_text')->nullable()->after('caption');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn([
                'banner_text',
                'stickers',
                'template_id',
                'media_items',
                'caption',
                'image_text'
            ]);
        });
    }
};


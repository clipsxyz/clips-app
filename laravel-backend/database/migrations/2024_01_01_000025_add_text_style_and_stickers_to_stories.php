<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Make media_url and media_type nullable for text-only stories
        // Note: This requires doctrine/dbal package for column modifications
        // If not available, you may need to use raw SQL or recreate the table
        if (Schema::hasColumn('stories', 'media_url')) {
            Schema::table('stories', function (Blueprint $table) {
                $table->string('media_url', 500)->nullable()->change();
            });
        }
        
        if (Schema::hasColumn('stories', 'media_type')) {
            Schema::table('stories', function (Blueprint $table) {
                $table->string('media_type', 20)->nullable()->change();
            });
        }
        
        Schema::table('stories', function (Blueprint $table) {
            // Add text_style for text-only stories (JSON: { "color": "#FFFFFF", "size": "medium", "background": "gradient-1" })
            if (!Schema::hasColumn('stories', 'text_style')) {
                $table->json('text_style')->nullable()->after('text_size');
            }
            
            // Add stickers for stories (JSON array of StickerOverlay objects)
            if (!Schema::hasColumn('stories', 'stickers')) {
                $table->json('stickers')->nullable()->after('text_style');
            }
            
            // Add tagged_users for stories (JSON array of user handles)
            if (!Schema::hasColumn('stories', 'tagged_users')) {
                $table->json('tagged_users')->nullable()->after('stickers');
            }
        });
    }

    public function down(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            $table->string('media_url', 500)->nullable(false)->change();
            $table->string('media_type', 20)->nullable(false)->change();
            $table->dropColumn(['text_style', 'stickers', 'tagged_users']);
        });
    }
};


<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('posts', 'card_style')) {
            return;
        }

        Schema::table('posts', function (Blueprint $table) {
            $table->string('card_style', 40)->nullable()->after('text_style');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('posts', 'card_style')) {
            return;
        }

        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('card_style');
        });
    }
};

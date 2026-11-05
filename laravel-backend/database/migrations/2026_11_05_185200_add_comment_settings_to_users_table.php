<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'allow_comments')) {
                $table->boolean('allow_comments')->default(true)->after('is_private');
            }
            if (! Schema::hasColumn('users', 'comment_audience')) {
                $table->string('comment_audience', 20)->default('everyone')->after('allow_comments');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'comment_audience')) {
                $table->dropColumn('comment_audience');
            }
            if (Schema::hasColumn('users', 'allow_comments')) {
                $table->dropColumn('allow_comments');
            }
        });
    }
};

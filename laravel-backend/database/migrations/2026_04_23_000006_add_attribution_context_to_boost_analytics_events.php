<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('boost_analytics_events', function (Blueprint $table) {
            $table->string('attribution_context', 40)->nullable()->after('event_type');
            $table->index(['boost_id', 'attribution_context']);
        });
    }

    public function down(): void
    {
        Schema::table('boost_analytics_events', function (Blueprint $table) {
            $table->dropIndex(['boost_id', 'attribution_context']);
            $table->dropColumn('attribution_context');
        });
    }
};


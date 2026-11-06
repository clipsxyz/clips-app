<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            $this->rebuildSqliteTable();

            return;
        }

        DB::statement("ALTER TABLE boost_analytics_events MODIFY event_type ENUM('impression','like','comment','share','profile_visit','message_start','click','reach') NOT NULL");
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE boost_analytics_events MODIFY event_type ENUM('impression','like','comment','share','profile_visit','message_start') NOT NULL");
    }

    private function rebuildSqliteTable(): void
    {
        DB::statement('PRAGMA foreign_keys=OFF');
        $rows = DB::table('boost_analytics_events')->get()
            ->map(fn ($row) => (array) $row)
            ->all();
        Schema::drop('boost_analytics_events');
        Schema::create('boost_analytics_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('boost_id');
            $table->uuid('post_id');
            $table->uuid('actor_user_id')->nullable();
            $table->string('event_type', 32);
            $table->string('attribution_context', 40)->nullable();
            $table->timestamps();

            $table->foreign('boost_id')->references('id')->on('boosts')->onDelete('cascade');
            $table->index(['boost_id', 'event_type', 'created_at']);
            $table->index(['post_id', 'created_at']);
            $table->index(['boost_id', 'attribution_context']);
        });
        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('boost_analytics_events')->insert($chunk);
        }
        DB::statement('PRAGMA foreign_keys=ON');
    }
};

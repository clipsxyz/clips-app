<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boost_analytics_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('boost_id');
            $table->uuid('post_id');
            $table->uuid('actor_user_id')->nullable();
            $table->enum('event_type', [
                'impression',
                'like',
                'comment',
                'share',
                'profile_visit',
                'message_start',
            ]);
            $table->timestamps();

            $table->foreign('boost_id')->references('id')->on('boosts')->onDelete('cascade');
            $table->index(['boost_id', 'event_type', 'created_at']);
            $table->index(['post_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('boost_analytics_events');
    }
};


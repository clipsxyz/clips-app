<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('profile_visit_events', function (Blueprint $table) {
            $table->id();
            $table->uuid('profile_user_id');
            $table->uuid('actor_user_id')->nullable();
            $table->uuid('source_post_id')->nullable();
            $table->unsignedBigInteger('boost_id')->nullable();
            $table->string('attribution_context', 40)->nullable();
            $table->timestamps();

            $table->index(['profile_user_id', 'created_at']);
            $table->index(['profile_user_id', 'actor_user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('profile_visit_events');
    }
};

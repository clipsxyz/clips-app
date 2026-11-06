<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->boolean('is_boosted')->default(false);
            $table->timestamp('boosted_until')->nullable();
            $table->decimal('boost_radius', 8, 2)->nullable();
            $table->string('boost_tier', 32)->nullable();
        });

        Schema::create('boost_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('stripe_session_id')->unique();
            $table->uuid('post_id');
            $table->uuid('user_id');
            $table->decimal('radius', 8, 2)->nullable();
            $table->string('tier', 32);
            $table->unsignedInteger('duration');
            $table->unsignedInteger('amount_cents')->nullable();
            $table->string('currency', 8)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->foreign('post_id')->references('id')->on('posts')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('boost_transactions');

        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn(['is_boosted', 'boosted_until', 'boost_radius', 'boost_tier']);
        });
    }
};

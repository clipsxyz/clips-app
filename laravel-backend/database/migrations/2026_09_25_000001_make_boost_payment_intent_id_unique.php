<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One boost per Stripe PaymentIntent.
 *
 * Boost activation can be triggered by both the client redirect and the
 * `payment_intent.succeeded` webhook. Without a unique constraint a payment
 * that arrives twice (double-tap, retried webhook, redirect replay) would
 * create duplicate boost rows for the same charge.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('boosts') || !Schema::hasColumn('boosts', 'payment_intent_id')) {
            return;
        }

        // Keep the earliest boost per PaymentIntent, drop any accidental repeats.
        $duplicateIds = DB::table('boosts')
            ->whereNotNull('payment_intent_id')
            ->select('payment_intent_id', DB::raw('MIN(id) as keep_id'), DB::raw('COUNT(*) as dup_count'))
            ->groupBy('payment_intent_id')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('payment_intent_id');

        foreach ($duplicateIds as $paymentIntentId) {
            $keepId = DB::table('boosts')
                ->where('payment_intent_id', $paymentIntentId)
                ->orderBy('id')
                ->value('id');

            DB::table('boosts')
                ->where('payment_intent_id', $paymentIntentId)
                ->where('id', '!=', $keepId)
                ->delete();
        }

        Schema::table('boosts', function (Blueprint $table) {
            $table->dropIndex(['payment_intent_id']);
            // NULL values stay allowed, so manual/legacy boosts are unaffected.
            $table->unique('payment_intent_id', 'boosts_payment_intent_id_unique');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('boosts') || !Schema::hasColumn('boosts', 'payment_intent_id')) {
            return;
        }

        Schema::table('boosts', function (Blueprint $table) {
            $table->dropUnique('boosts_payment_intent_id_unique');
            $table->index('payment_intent_id');
        });
    }
};

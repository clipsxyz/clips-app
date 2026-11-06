<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boost_metrics', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('boost_id');
            $table->foreign('boost_id')->references('id')->on('boosts')->onDelete('cascade');
            $table->unsignedBigInteger('impressions')->default(0);
            $table->unsignedBigInteger('reach')->default(0);
            $table->unsignedBigInteger('clicks')->default(0);
            $table->decimal('ctr', 5, 2)->default(0);
            $table->date('date');
            $table->timestamps();

            $table->unique(['boost_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('boost_metrics');
    }
};

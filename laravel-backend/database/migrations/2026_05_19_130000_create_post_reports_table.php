<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reporter_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('post_id', 64);
            $table->string('reason', 64)->nullable();
            $table->text('details')->nullable();
            $table->timestamps();
            $table->unique(['reporter_user_id', 'post_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_reports');
    }
};

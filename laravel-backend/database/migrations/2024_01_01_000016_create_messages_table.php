<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('conversation_id', 255); // sorted handle pair: "handle1|handle2"
            $table->string('sender_handle', 100);
            $table->string('recipient_handle', 100);
            $table->text('text')->nullable();
            $table->string('image_url', 500)->nullable();
            $table->boolean('is_system_message')->default(false);
            $table->timestamps();

            $table->index(['conversation_id', 'created_at']);
            $table->index(['sender_handle', 'created_at']);
            $table->index(['recipient_handle', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};


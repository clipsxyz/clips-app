<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DatabaseTransactionTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_transaction_rolls_back_on_failure(): void
    {
        $email = 'rollback-demo@example.com';

        DB::beginTransaction();

        $user = User::factory()->create([
            'email' => $email,
            'username' => 'rollback-demo',
            'handle' => '@rollback-demo',
        ]);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'email' => $email,
        ]);

        DB::rollBack();

        $this->assertDatabaseMissing('users', [
            'email' => $email,
        ]);
    }
}

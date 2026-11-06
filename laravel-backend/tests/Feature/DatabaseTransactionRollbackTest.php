<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class DatabaseTransactionRollbackTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_transaction_rolls_back_on_failure(): void
    {
        $this->assertTrue(Schema::hasTable('users'));

        $email = 'rollback-demo@example.com';

        DB::beginTransaction();

        try {
            $user = User::factory()->create([
                'email' => $email,
                'username' => 'rollback-demo',
                'handle' => '@rollback-demo',
            ]);

            $this->assertDatabaseHas('users', [
                'id' => $user->id,
                'email' => $email,
            ]);

            throw new RuntimeException('Simulated failure inside the transaction.');
        } catch (RuntimeException $exception) {
            DB::rollBack();
        }

        $this->assertDatabaseMissing('users', [
            'email' => $email,
        ]);
    }
}

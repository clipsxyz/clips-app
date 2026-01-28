<?php

namespace Tests\Unit\Models;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Schema::disableForeignKeyConstraints();
    }

    protected function tearDown(): void
    {
        Schema::enableForeignKeyConstraints();
        parent::tearDown();
    }

    public function test_unread_scope_returns_only_unread(): void
    {
        $user = User::factory()->create();
        $unread = Notification::create([
            'user_id' => $user->id,
            'type' => 'like',
            'from_handle' => '@other',
            'to_handle' => $user->handle,
            'message' => 'Someone liked your post',
            'read' => false,
        ]);
        Notification::create([
            'user_id' => $user->id,
            'type' => 'comment',
            'from_handle' => '@other',
            'to_handle' => $user->handle,
            'message' => 'Someone commented',
            'read' => true,
        ]);

        $results = Notification::unread()->pluck('id')->all();

        $this->assertContains($unread->id, $results);
        $this->assertCount(1, $results);
    }

    public function test_by_type_scope_filters_by_type(): void
    {
        $user = User::factory()->create();
        $like = Notification::create([
            'user_id' => $user->id,
            'type' => 'like',
            'from_handle' => '@other',
            'to_handle' => $user->handle,
            'message' => 'Liked',
            'read' => false,
        ]);
        Notification::create([
            'user_id' => $user->id,
            'type' => 'comment',
            'from_handle' => '@other',
            'to_handle' => $user->handle,
            'message' => 'Commented',
            'read' => false,
        ]);

        $results = Notification::byType('like')->pluck('id')->all();

        $this->assertContains($like->id, $results);
        $this->assertCount(1, $results);
    }

    public function test_for_user_scope_filters_by_user_id(): void
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();
        $n1 = Notification::create([
            'user_id' => $user1->id,
            'type' => 'like',
            'from_handle' => '@other',
            'to_handle' => $user1->handle,
            'message' => 'Liked',
            'read' => false,
        ]);
        Notification::create([
            'user_id' => $user2->id,
            'type' => 'like',
            'from_handle' => '@other',
            'to_handle' => $user2->handle,
            'message' => 'Liked',
            'read' => false,
        ]);

        $results = Notification::forUser($user1->id)->pluck('id')->all();

        $this->assertContains($n1->id, $results);
        $this->assertCount(1, $results);
    }

    public function test_mark_as_read_sets_read_true(): void
    {
        $user = User::factory()->create();
        $notification = Notification::create([
            'user_id' => $user->id,
            'type' => 'like',
            'from_handle' => '@other',
            'to_handle' => $user->handle,
            'message' => 'Liked',
            'read' => false,
        ]);

        $notification->markAsRead();

        $this->assertTrue($notification->fresh()->read);
    }
}

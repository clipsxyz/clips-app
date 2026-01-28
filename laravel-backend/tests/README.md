# PHPUnit Tests

This directory contains PHPUnit tests for the Laravel backend.

## Running Tests

### Run all tests
```bash
cd laravel-backend
php vendor/bin/phpunit
# or
composer test
```

### Run specific test suite
```bash
# Run only unit tests
php vendor/bin/phpunit tests/Unit
composer test:unit

# Run only feature tests
php vendor/bin/phpunit tests/Feature
composer test:feature
```

### Run specific test file
```bash
php vendor/bin/phpunit tests/Unit/Models/RenderJobTest.php
```

### Run with coverage
```bash
php vendor/bin/phpunit --coverage-html coverage
# or
composer test:coverage
```
This writes an HTML report to `coverage/`. You need a coverage driver (Xdebug or PCOV) enabled in PHP; otherwise you'll see "No code coverage driver available". **See [COVERAGE.md](../COVERAGE.md)** for step-by-step setup (enable driver, generate report, open `coverage/index.html`).

## Test Structure

- **Unit Tests** (`tests/Unit/`): Test individual components in isolation
  - Models
  - Jobs
  - Services
  
- **Feature Tests** (`tests/Feature/`): Test API endpoints and integration
  - Controllers
  - API routes
  - Full request/response cycles

## Test Files

### Unit Tests
- `Unit/Models/PostTest.php` - Post scopes and helpers
- `Unit/Models/MusicTest.php` - Music scopes and helpers
- `Unit/Models/RenderJobTest.php` - RenderJob model
- `Unit/Models/UserTest.php` - User helpers (canViewProfile, hasLikedPost, hasBookmarked, etc.)
- `Unit/Models/StoryTest.php` - Story scopes and helpers
- `Unit/Models/CommentTest.php` - Comment scopes (topLevel) and helpers (isReply, isLikedBy)
- `Unit/Models/CollectionTest.php` - Collection scopes (public, private, forUser) and containsPost
- `Unit/Models/NotificationTest.php` - Notification scopes (unread, byType, forUser) and markAsRead
- `Unit/Jobs/ProcessRenderJobTest.php` - Video rendering job

### Feature Tests
- `Feature/AuthControllerTest.php` - Register, login, me, invalid credentials
- `Feature/PostControllerTest.php` - Post creation, feed, single post, validation
- `Feature/RenderJobApiTest.php` - Render job status API
- `Feature/NotificationControllerTest.php` - FCM token and notification preferences
- `Feature/StoryControllerTest.php` - Story create, view, reaction, reply
- `Feature/CommentControllerTest.php` - Comments: get, add, reply, toggle like
- `Feature/UserControllerTest.php` - User profile (public, private, 401)
- `Feature/CollectionControllerTest.php` - Collections: list, create, validate
- `Feature/SearchControllerTest.php` - Unified search (q, types, users/posts)

## Factories

Factories are located in `database/factories/`:
- `UserFactory.php` - Creates test users
- `PostFactory.php` - Creates test posts
- `RenderJobFactory.php` - Creates test render jobs
- `StoryFactory.php` - Creates test stories (use `forUser($user)` when overriding user)

## Configuration

Test configuration is in `phpunit.xml`:
- Uses file-based SQLite (`database/testing.sqlite`) for tests
- Sets up test environment variables
- Configures test suites and coverage

## Writing New Tests

1. Create test file in appropriate directory (`Unit/` or `Feature/`)
2. Extend `Tests\TestCase`
3. Use `RefreshDatabase` trait for database tests
4. Use factories to create test data
5. Follow naming convention: `test_method_name_returns_expected_result()`

Example:
```php
<?php

namespace Tests\Unit\Models;

use Tests\TestCase;
use App\Models\YourModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

class YourModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_model_can_be_created(): void
    {
        $model = YourModel::factory()->create();
        
        $this->assertDatabaseHas('your_table', [
            'id' => $model->id,
        ]);
    }
}
```




























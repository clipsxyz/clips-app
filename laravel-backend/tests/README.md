# PHPUnit Tests

This directory contains PHPUnit tests for the Laravel backend.

## Running Tests

### Run all tests
```bash
cd laravel-backend
php vendor/bin/phpunit
```

### Run specific test suite
```bash
# Run only unit tests
php vendor/bin/phpunit tests/Unit

# Run only feature tests
php vendor/bin/phpunit tests/Feature
```

### Run specific test file
```bash
php vendor/bin/phpunit tests/Unit/Models/RenderJobTest.php
```

### Run with coverage
```bash
php vendor/bin/phpunit --coverage-html coverage
```

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
- `Unit/Models/RenderJobTest.php` - Tests for RenderJob model
- `Unit/Jobs/ProcessRenderJobTest.php` - Tests for video rendering job

### Feature Tests
- `Feature/PostControllerTest.php` - Tests for post creation and retrieval
- `Feature/RenderJobApiTest.php` - Tests for render job status API

## Factories

Factories are located in `database/factories/`:
- `UserFactory.php` - Creates test users
- `PostFactory.php` - Creates test posts
- `RenderJobFactory.php` - Creates test render jobs

## Configuration

Test configuration is in `phpunit.xml`:
- Uses SQLite in-memory database for speed
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

















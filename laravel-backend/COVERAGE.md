# Code Coverage (PHPUnit)

This guide explains how to generate and view HTML code coverage for the Laravel backend tests.

## Prerequisites: Enable a coverage driver

PHPUnit needs either **PCOV** or **Xdebug** to collect coverage. Enable **one** of them in your PHP config.

### Option A: PCOV (recommended – fast and simple)

1. **Install PCOV** (if not already installed):
   - **Windows**: Download from [PECL](https://pecl.php.net/package/pcov) or use a PHP build that includes PCOV (e.g. Laragon, XAMPP with PCOV).
   - **Linux**: `sudo apt install php8.x-pcov` (adjust 8.x to your PHP version).
   - **macOS**: `pecl install pcov` then add to `php.ini`.

2. **Enable in `php.ini`**:
   ```ini
   [pcov]
   pcov.enabled=1
   ```

3. **Locate `php.ini`** (if unsure):
   ```bash
   php --ini
   ```

### Option B: Xdebug

1. **Install Xdebug** if needed: [xdebug.org/docs/install](https://xdebug.org/docs/install).

2. **In `php.ini`**, set coverage mode (Xdebug 3+):
   ```ini
   [xdebug]
   xdebug.mode=coverage
   ```
   For Xdebug 2.x use: `xdebug.coverage_enable=1`

3. **Optional**: Disable other Xdebug modes when only running tests to avoid slowdown:
   ```ini
   xdebug.mode=coverage
   ```

### Verify

```bash
cd laravel-backend
php -r "var_dump(extension_loaded('pcov') || extension_loaded('xdebug'));"
# Should print: bool(true)
```

If you see "No code coverage driver available" when running coverage, PHPUnit could not find PCOV or Xdebug – double-check the extension and `php.ini`.

---

## Generate the report

From the **laravel-backend** directory:

```bash
composer test:coverage
# or
php vendor/bin/phpunit --coverage-html coverage
```

- The report is written to **`laravel-backend/coverage/`**.
- Open **`coverage/index.html`** in a browser (e.g. `file:///C:/Users/.../clips-app/laravel-backend/coverage/index.html`).

---

## What you get

- **index.html**: Summary by directory/file and overall percentage.
- Drill down into files to see line-by-line coverage (green = covered, red = not covered).

The `coverage/` directory is in `.gitignore`; do not commit it.

---

## Quick reference

| Step | Command / action |
|------|------------------|
| 1. Enable driver | Add `pcov.enabled=1` or `xdebug.mode=coverage` to `php.ini` |
| 2. Generate | `cd laravel-backend` then `composer test:coverage` |
| 3. View | Open `laravel-backend/coverage/index.html` in a browser |

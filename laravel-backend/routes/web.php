<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\File;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', function () {
    return response()->json([
        'message' => 'Gazetteer API',
        'version' => '1.0.0',
        'status' => 'running'
    ]);
});

Route::get('/invite-logo', function () {
    $logoPath = base_path('../src/assets/gazetteer-splash-logo.png');
    if (!File::exists($logoPath)) {
        abort(404);
    }
    return response()->file($logoPath, [
        'Cache-Control' => 'public, max-age=3600',
    ]);
});

Route::get('/invite/{handle}', function (string $handle) {
    $safeHandle = trim($handle);
    $frontend = rtrim(env('FRONTEND_APP_URL', 'http://localhost:5173'), '/');
    $signupUrl = $frontend . '/login?mode=signup&invite=' . urlencode($safeHandle);
    $title = "@{$safeHandle} invited you to join Gazetteer";
    $description = 'Join Gazetteer to connect with your friends and discover clips near you.';
    $imageUrl = url('/invite-logo');
    $canonical = url('/invite/' . urlencode($safeHandle));

    $html = '<!doctype html><html lang="en"><head>'
        . '<meta charset="utf-8" />'
        . '<meta name="viewport" content="width=device-width, initial-scale=1" />'
        . '<title>' . e($title) . '</title>'
        . '<meta name="description" content="' . e($description) . '" />'
        . '<meta property="og:type" content="website" />'
        . '<meta property="og:site_name" content="Gazetteer" />'
        . '<meta property="og:title" content="' . e($title) . '" />'
        . '<meta property="og:description" content="' . e($description) . '" />'
        . '<meta property="og:image" content="' . e($imageUrl) . '" />'
        . '<meta property="og:url" content="' . e($canonical) . '" />'
        . '<meta name="twitter:card" content="summary_large_image" />'
        . '<meta name="twitter:title" content="' . e($title) . '" />'
        . '<meta name="twitter:description" content="' . e($description) . '" />'
        . '<meta name="twitter:image" content="' . e($imageUrl) . '" />'
        . '<meta http-equiv="refresh" content="0;url=' . e($signupUrl) . '" />'
        . '</head><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#030712;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;">'
        . '<div style="text-align:center;max-width:420px;padding:24px;">'
        . '<img src="' . e($imageUrl) . '" alt="Gazetteer logo" style="width:96px;height:96px;border-radius:20px;margin:0 auto 12px;display:block;" />'
        . '<h1 style="font-size:24px;line-height:1.2;margin:0 0 8px;">' . e($title) . '</h1>'
        . '<p style="opacity:.85;margin:0 0 16px;">' . e($description) . '</p>'
        . '<a href="' . e($signupUrl) . '" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;padding:10px 14px;border-radius:999px;font-weight:700;">Continue to sign up</a>'
        . '</div></body></html>';

    return response($html, 200)->header('Content-Type', 'text/html; charset=UTF-8');
});

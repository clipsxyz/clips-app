# Laravel API Integration Testing Guide

## ✅ Integration Complete

All main API functions in `src/api/posts.ts` have been updated to use the Laravel backend with automatic fallback to mock data.

## 🔧 Environment Setup

### 1. Create `.env` file (if it doesn't exist)

Copy from `env.example`:
```bash
cp env.example .env
```

Or create manually with:
```env
# Frontend Environment Variables

## API Configuration
VITE_API_URL=http://localhost:8000/api
VITE_USE_LARAVEL_API=true

## Google Maps API
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

## App Configuration
VITE_APP_NAME=Gazetteer
VITE_APP_VERSION=1.0.0

## Feature Flags
VITE_ENABLE_OFFLINE=true
VITE_ENABLE_PWA=true

## Development
VITE_DEV_MODE=true
```

### 2. Start Laravel Backend

```bash
cd laravel-backend
php artisan serve
```

The backend should be running on `http://localhost:8000`

### 3. Start Frontend Dev Server

```bash
npm run dev
```

The frontend should be running on `http://localhost:5173`

## 🧪 Testing the Integration

### Test Script

Run the test script to verify Laravel API connectivity:

```bash
node test-laravel-api.js
```

### Manual Testing Checklist

#### ✅ 1. Fetch Posts
- [ ] Open browser console
- [ ] Navigate to feed page
- [ ] Check console for API calls
- [ ] Verify posts load from Laravel (or fallback to mock if Laravel is down)

#### ✅ 2. Like/Unlike Post
- [ ] Click like button on a post
- [ ] Check console for API call
- [ ] Verify like count updates
- [ ] Check Laravel backend logs for POST /api/posts/{id}/like

#### ✅ 3. Add Comment
- [ ] Open a post
- [ ] Add a comment
- [ ] Check console for API call
- [ ] Verify comment appears
- [ ] Check Laravel backend logs for POST /api/comments/post/{id}

#### ✅ 4. Create Post
- [ ] Create a new post
- [ ] Check console for API call
- [ ] Verify post appears in feed
- [ ] Check Laravel backend logs for POST /api/posts

#### ✅ 5. View Tracking
- [ ] Scroll through posts
- [ ] Check console for view tracking calls
- [ ] Verify views increment (may be debounced)
- [ ] Check Laravel backend logs for POST /api/posts/{id}/view

#### ✅ 6. Share Post
- [ ] Share a post
- [ ] Check console for API call
- [ ] Verify share count updates
- [ ] Check Laravel backend logs for POST /api/posts/{id}/share

#### ✅ 7. Reclip Post
- [ ] Reclip a post
- [ ] Check console for API call
- [ ] Verify reclip count updates
- [ ] Check Laravel backend logs for POST /api/posts/{id}/reclip

## 🔍 Debugging

### Check if Laravel API is Being Used

1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by "Fetch/XHR"
4. Look for requests to `localhost:8000/api`
5. If you see requests, Laravel API is active
6. If you don't see requests, check:
   - Is `VITE_USE_LARAVEL_API=true` in `.env`?
   - Is Laravel backend running?
   - Check console for error messages

### Common Issues

#### Issue: "Network error" or "Failed to fetch"
**Solution:**
- Check if Laravel backend is running: `php artisan serve`
- Verify `VITE_API_URL=http://localhost:8000/api` in `.env`
- Restart frontend dev server after changing `.env`

#### Issue: "401 Unauthorized"
**Solution:**
- Check if user is authenticated
- Verify auth token in localStorage
- Check Laravel Sanctum configuration

#### Issue: "404 Not Found"
**Solution:**
- Verify API routes in `laravel-backend/routes/api.php`
- Check if route requires authentication
- Verify endpoint path matches frontend expectations

#### Issue: Response format doesn't match
**Solution:**
- Check `transformLaravelPost()` function in `src/api/posts.ts`
- Verify Laravel response format matches expected format
- Check console for transformation errors

### Fallback to Mock Data

If Laravel API fails, the app automatically falls back to mock data. You'll see:
- Console warning: "Laravel API call failed, falling back to mock data"
- App continues to work with mock data
- No user-facing errors

To disable Laravel API temporarily:
```env
VITE_USE_LARAVEL_API=false
```

## 📊 Response Transformation

The `transformLaravelPost()` function handles:
- ✅ Snake_case to camelCase conversion
- ✅ Date string to epoch timestamp conversion
- ✅ Stats object transformation
- ✅ User relationship data extraction
- ✅ Media URL handling (final_video_url vs media_url)
- ✅ Optional fields (stickers, textStyle, etc.)

## 🚀 Next Steps

1. **Test all endpoints** - Verify each function works correctly
2. **Monitor console** - Check for any transformation errors
3. **Test error handling** - Verify fallback works when Laravel is down
4. **Performance testing** - Compare Laravel vs mock data performance
5. **Production deployment** - Update `VITE_API_URL` to production backend URL

## 📝 Notes

- All functions try Laravel API first, then fallback to mock
- Mock data is still available for development/testing
- Response transformations handle both snake_case and camelCase
- Error handling is graceful - app continues to work even if API fails






















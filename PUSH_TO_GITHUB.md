# Push current changes to GitHub

Run these in your terminal from the project root (`clips-app`):

```powershell
cd c:\Users\visua\clips-app

# Stage only the files we changed (skip cache/logs)
git add src/App.tsx src/api/client.ts src/api/messages.ts src/api/posts.ts
git add src/components/CommentsModal.tsx src/components/Root.tsx src/components/ShareModal.tsx
git add src/context/Auth.tsx src/pages/MessagesPage.tsx
git add laravel-backend/README.md laravel-backend/app/Http/Controllers/Api/MessageController.php
git add laravel-backend/app/Http/Controllers/Api/PostController.php laravel-backend/app/Models/Message.php
git add laravel-backend/routes/api.php
git add laravel-backend/database/migrations/2025_02_01_000001_drop_feed_cache_table.php
git add laravel-backend/database/migrations/2025_02_01_000002_add_read_at_to_messages_table.php
git add .github/

# Commit
git commit -m "DM wiring, feed fixes, posts storage dedupe, read tracking, feed cache drop"

# Push
git push origin main
```

If you prefer to stage everything (including README and any other modified files) and exclude only storage:

```powershell
cd c:\Users\visua\clips-app
git add -A
git reset laravel-backend/storage/
git commit -m "DM wiring, feed fixes, posts storage dedupe, read tracking, feed cache drop"
git push origin main
```

# File Storage Configuration - Images and Media

## 🔍 Current Configuration

### ✅ Current Setup: **Local Storage**
- **Storage Driver**: `FILESYSTEM_DISK=local` (from `env.example`)
- **Storage Location**: `storage/app/public/uploads/`
- **Public Access**: Files stored in `public` disk (accessible via symlink)
- **UploadController**: Uses `storeAs('uploads', $filename, 'public')`

### ❌ S3 Not Configured
- **AWS_ACCESS_KEY_ID**: Empty (not set)
- **AWS_SECRET_ACCESS_KEY**: Empty (not set)
- **AWS_BUCKET**: Empty (not set)
- **AWS_DEFAULT_REGION**: `us-east-1` (default)

---

## 📁 How Files Are Currently Stored

### Local Storage (Current)
```
laravel-backend/
├── storage/
│   └── app/
│       └── public/
│           └── uploads/
│               ├── 1234567890-abc123.jpg
│               ├── 1234567891-def456.mp4
│               └── ...
└── public/
    └── storage -> ../storage/app/public (symlink)
```

**File URLs**: `http://your-domain.com/storage/uploads/1234567890-abc123.jpg`

**Pros:**
- ✅ Simple setup
- ✅ No external service needed
- ✅ Good for development

**Cons:**
- ❌ Limited by server disk space
- ❌ Not scalable for production
- ❌ Slower for users far from server
- ❌ No CDN benefits

---

## ☁️ Setting Up AWS S3 Storage

### Step 1: Create S3 Bucket

1. Log in to AWS Console
2. Go to S3 service
3. Click "Create bucket"
4. Configure:
   - **Bucket name**: `gazetteer-media` (or your preferred name)
   - **Region**: `us-east-1` (or your preferred region)
   - **Block Public Access**: **Uncheck** (to allow public access to media)
   - **Bucket Versioning**: Optional (recommended for production)
   - **Server-side encryption**: Enable (recommended)

5. Create bucket

### Step 2: Configure Bucket Permissions

**Bucket Policy** (for public read access):
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::gazetteer-media/*"
        }
    ]
}
```

**CORS Configuration** (for cross-origin requests):
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"]
    }
]
```

### Step 3: Create IAM User for S3 Access

1. Go to IAM → Users → Create User
2. Username: `gazetteer-s3-user`
3. Attach policy: `AmazonS3FullAccess` (or create custom policy for specific bucket)
4. Create user
5. **Save Access Key ID and Secret Access Key** (you'll need these)

### Step 4: Install AWS SDK for Laravel

```bash
cd laravel-backend
composer require league/flysystem-aws-s3-v3 "^3.0"
```

### Step 5: Update Environment Variables

Edit `.env`:
```env
FILESYSTEM_DISK=s3

AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=gazetteer-media
AWS_USE_PATH_STYLE_ENDPOINT=false

# Optional: Custom S3 endpoint (for DigitalOcean Spaces, etc.)
# AWS_ENDPOINT=https://nyc3.digitaloceanspaces.com
```

### Step 6: Update UploadController for S3

The `UploadController` will automatically use S3 once `FILESYSTEM_DISK=s3` is set, but we should verify it works correctly.

---

## 🔧 Update UploadController for Production

Here's an improved version that supports both local and S3:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class UploadController extends Controller
{
    /**
     * Upload single file
     */
    public function single(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|max:10240|mimes:jpeg,jpg,png,gif,mp4,webm'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $file = $request->file('file');
        $user = Auth::user();

        // Generate unique filename with user ID
        $filename = $user->id . '/' . time() . '-' . uniqid() . '.' . $file->getClientOriginalExtension();
        
        // Store file (automatically uses S3 if FILESYSTEM_DISK=s3)
        $disk = config('filesystems.default');
        $path = $file->storeAs('uploads', $filename, $disk);

        // Get full URL (handles both local and S3)
        $fileUrl = Storage::disk($disk)->url($path);

        return response()->json([
            'success' => true,
            'fileUrl' => $fileUrl,
            'filename' => $filename,
            'originalName' => $file->getClientOriginalName(),
            'size' => $file->getSize(),
            'mimetype' => $file->getMimeType()
        ]);
    }

    /**
     * Upload multiple files
     */
    public function multiple(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'files.*' => 'required|file|max:10240|mimes:jpeg,jpg,png,gif,mp4,webm'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $files = $request->file('files');
        $user = Auth::user();
        $uploadedFiles = [];
        $disk = config('filesystems.default');

        foreach ($files as $file) {
            // Generate unique filename with user ID
            $filename = $user->id . '/' . time() . '-' . uniqid() . '.' . $file->getClientOriginalExtension();
            
            // Store file
            $path = $file->storeAs('uploads', $filename, $disk);
            $fileUrl = Storage::disk($disk)->url($path);

            $uploadedFiles[] = [
                'fileUrl' => $fileUrl,
                'filename' => $filename,
                'originalName' => $file->getClientOriginalName(),
                'size' => $file->getSize(),
                'mimetype' => $file->getMimeType()
            ];
        }

        return response()->json([
            'success' => true,
            'files' => $uploadedFiles
        ]);
    }
}
```

---

## 📋 Storage Configuration Summary

### Current State
- ✅ **Local Storage**: Configured and working
- ❌ **S3 Storage**: Not configured (needs setup)

### File Storage Locations
- **Posts**: `media_url` field stores URL to image/video
- **Stories**: `media_url` field stores URL to image/video
- **Messages**: `image_url` field stores URL to image
- **User Avatars**: `avatar_url` field stores URL to image

### URLs Format
- **Local**: `http://your-domain.com/storage/uploads/1234567890-abc123.jpg`
- **S3**: `https://gazetteer-media.s3.amazonaws.com/uploads/1234567890-abc123.jpg`

---

## 🚀 Migration Path: Local → S3

### Option 1: Start with S3 (Recommended for Production)
1. Set up S3 bucket
2. Configure AWS credentials in `.env`
3. Set `FILESYSTEM_DISK=s3`
4. All new uploads go to S3

### Option 2: Migrate Existing Files
If you have existing files in local storage:

```bash
# Install S3 sync tool
composer require aws/aws-sdk-php

# Create migration script
php artisan make:command MigrateFilesToS3
```

Then create a command to sync existing files:
```php
// Migrate all files from local to S3
$files = Storage::disk('public')->files('uploads');
foreach ($files as $file) {
    $contents = Storage::disk('public')->get($file);
    Storage::disk('s3')->put($file, $contents);
}
```

---

## 🔐 Security Best Practices

### For Production
1. ✅ **Use IAM Roles** (if on AWS EC2) instead of access keys
2. ✅ **Restrict S3 Policy** to specific bucket only
3. ✅ **Enable S3 Versioning** for disaster recovery
4. ✅ **Enable S3 Lifecycle Policies** to auto-delete old files
5. ✅ **Use CloudFront CDN** for faster delivery
6. ✅ **Enable S3 Transfer Acceleration** for faster uploads

### Bucket Policy (Restrictive)
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowPublicRead",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::gazetteer-media/uploads/*"
        },
        {
            "Sid": "AllowAppWrite",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/gazetteer-s3-user"
            },
            "Action": ["s3:PutObject", "s3:DeleteObject"],
            "Resource": "arn:aws:s3:::gazetteer-media/uploads/*"
        }
    ]
}
```

---

## 📊 Storage Costs Estimation

### AWS S3 Pricing (us-east-1)
- **Storage**: $0.023 per GB/month
- **PUT Requests**: $0.005 per 1,000 requests
- **GET Requests**: $0.0004 per 1,000 requests
- **Data Transfer Out**: $0.09 per GB (first 10 TB)

### Example Calculation
- 10,000 users
- Average 5 images per user (2MB each)
- Total: ~100GB storage
- **Monthly Cost**: ~$2.30 storage + transfer costs

---

## ✅ Checklist

### For Local Storage (Current)
- [x] UploadController configured
- [x] Files stored in `storage/app/public/uploads/`
- [x] Public symlink created: `php artisan storage:link`
- [x] File size limits: 10MB (configurable)
- [x] Allowed types: jpeg, png, gif, mp4, webm

### For S3 Storage (To Do)
- [ ] Create S3 bucket
- [ ] Configure bucket permissions (public read)
- [ ] Create IAM user with S3 access
- [ ] Install AWS SDK: `composer require league/flysystem-aws-s3-v3`
- [ ] Update `.env` with AWS credentials
- [ ] Set `FILESYSTEM_DISK=s3`
- [ ] Test upload functionality
- [ ] Set up CloudFront CDN (optional)
- [ ] Configure lifecycle policies (optional)

---

## 🎯 Recommendations

### For Development
- ✅ **Use Local Storage** - Simple and fast
- ✅ Set `FILESYSTEM_DISK=local`

### For Production
- ✅ **Use S3 Storage** - Scalable and reliable
- ✅ Set `FILESYSTEM_DISK=s3`
- ✅ Add CloudFront CDN for performance
- ✅ Enable S3 Transfer Acceleration
- ✅ Set up lifecycle policies for old files

---

## 📝 Summary

**Current Status:**
- ✅ Local storage configured and working
- ❌ S3 not configured (needs AWS setup)

**You need to:**
1. Create AWS S3 bucket
2. Set up IAM user with S3 access
3. Install AWS SDK: `composer require league/flysystem-aws-s3-v3`
4. Update `.env` with AWS credentials
5. Change `FILESYSTEM_DISK=s3`
6. Test uploads

The code is ready to work with either local or S3 storage - just change the `FILESYSTEM_DISK` setting!



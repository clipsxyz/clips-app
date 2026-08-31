/**
 * image-crop-picker Android uses ACTION_GET_CONTENT + CATEGORY_OPENABLE,
 * which opens DocumentsUI Recents/Files instead of the OEM Gallery.
 * Switch to ACTION_PICK against MediaStore (camera roll).
 */
import fs from 'fs';
import path from 'path';

const file = path.join(
    process.cwd(),
    'node_modules/react-native-image-crop-picker/android/src/main/java/com/reactnative/ivpusic/imagepicker/PickerModule.java',
);

const needle = `    private void initiatePicker(final Activity activity) {
        try {
            final Intent galleryIntent = new Intent(Intent.ACTION_GET_CONTENT);

            if (cropping || mediaType.equals("photo")) {
                galleryIntent.setType("image/*");
                if (cropping) {
                    String[] mimetypes = {"image/jpeg", "image/png"};
                    galleryIntent.putExtra(Intent.EXTRA_MIME_TYPES, mimetypes);
                }
            } else if (mediaType.equals("video")) {
                galleryIntent.setType("video/*");
            } else {
                galleryIntent.setType("*/*");
                String[] mimetypes = {"image/*", "video/*"};
                galleryIntent.putExtra(Intent.EXTRA_MIME_TYPES, mimetypes);
            }

            galleryIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            galleryIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);
            galleryIntent.addCategory(Intent.CATEGORY_OPENABLE);

            final Intent chooserIntent = Intent.createChooser(galleryIntent, "Pick an image");
            activity.startActivityForResult(chooserIntent, IMAGE_PICKER_REQUEST);
        } catch (Exception e) {
            resultCollector.notifyProblem(E_FAILED_TO_SHOW_PICKER, e);
        }
    }`;

const replacement = `    private void initiatePicker(final Activity activity) {
        try {
            final Intent galleryIntent = new Intent(Intent.ACTION_PICK);

            if (cropping || mediaType.equals("photo")) {
                galleryIntent.setDataAndType(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, "image/*");
            } else if (mediaType.equals("video")) {
                galleryIntent.setDataAndType(android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI, "video/*");
            } else {
                galleryIntent.setDataAndType(android.provider.MediaStore.Files.getContentUri("external"), "*/*");
                galleryIntent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/*", "video/*"});
            }

            galleryIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);
            activity.startActivityForResult(galleryIntent, IMAGE_PICKER_REQUEST);
        } catch (Exception e) {
            resultCollector.notifyProblem(E_FAILED_TO_SHOW_PICKER, e);
        }
    }`;

if (!fs.existsSync(file)) {
    console.warn('[patch-crop-picker-gallery] skip (missing):', file);
    process.exit(0);
}

const src = fs.readFileSync(file, 'utf8');
if (src.includes('galleryIntent.setDataAndType(android.provider.MediaStore.Files.getContentUri')) {
    console.log('[patch-crop-picker-gallery] already patched');
    process.exit(0);
}
if (!src.includes(needle)) {
    console.warn('[patch-crop-picker-gallery] pattern not found');
    process.exit(0);
}
fs.writeFileSync(file, src.replace(needle, replacement));
console.log('[patch-crop-picker-gallery] patched PickerModule.java');

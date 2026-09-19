package com.clipsapp

import android.app.Activity
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.io.File
import java.io.FileOutputStream

/**
 * Opens the OEM Gallery / camera roll via ACTION_PICK (MediaStore),
 * not ACTION_GET_CONTENT (DocumentsUI Recents / Files).
 */
class GalleryRollPickerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var pickerPromise: Promise? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun open(options: ReadableMap, promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "Activity doesn't exist")
            return
        }

        pickerPromise = promise
        val multiple = if (options.hasKey("multiple")) options.getBoolean("multiple") else true
        val mediaType = if (options.hasKey("mediaType")) options.getString("mediaType") else "any"

        val intent = buildGalleryIntent(activity, mediaType, multiple)
        try {
            activity.startActivityForResult(intent, REQUEST_CODE)
        } catch (error: Exception) {
            pickerPromise = null
            promise.reject("E_FAILED_TO_SHOW_PICKER", error)
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CODE) return
        val promise = pickerPromise ?: return
        pickerPromise = null

        if (resultCode != Activity.RESULT_OK || data == null) {
            promise.reject("E_PICKER_CANCELLED", "User cancelled")
            return
        }

        try {
            val uris = collectUris(data)
            val result = Arguments.createArray()
            for (uri in uris) {
                val copied = copyToCache(uri) ?: continue
                result.pushMap(copied)
            }
            promise.resolve(result)
        } catch (error: Exception) {
            promise.reject("E_NO_IMAGE_DATA_FOUND", error)
        }
    }

    override fun onNewIntent(intent: Intent) {}

    @ReactMethod
    fun copyUriToCache(uriString: String, promise: Promise) {
        try {
            val trimmed = uriString.trim()
            if (trimmed.isEmpty()) {
                promise.reject("E_COPY", "Empty URI")
                return
            }
            val uri = Uri.parse(trimmed)
            if (uri.scheme == "file" || trimmed.startsWith("/")) {
                val file = fileFromUri(trimmed)
                val map = Arguments.createMap()
                map.putString(
                    "uri",
                    if (trimmed.startsWith("file://")) trimmed else "file://${file.absolutePath}",
                )
                map.putDouble("fileSize", if (file.exists()) file.length().toDouble() else 0.0)
                promise.resolve(map)
                return
            }
            val copied = copyToCache(uri)
            if (copied == null) {
                promise.reject("E_COPY", "Could not copy URI")
                return
            }
            promise.resolve(copied)
        } catch (error: Exception) {
            promise.reject("E_COPY", error)
        }
    }

    @ReactMethod
    fun statUri(uriString: String, promise: Promise) {
        try {
            val map = Arguments.createMap()
            val trimmed = uriString.trim()
            if (trimmed.isEmpty()) {
                map.putBoolean("exists", false)
                map.putDouble("size", 0.0)
                promise.resolve(map)
                return
            }
            val uri = Uri.parse(trimmed)
            if (uri.scheme == "file" || uri.scheme.isNullOrEmpty() || trimmed.startsWith("/")) {
                val file = fileFromUri(trimmed)
                val exists = file.exists()
                map.putBoolean("exists", exists)
                map.putDouble("size", if (exists) file.length().toDouble() else 0.0)
                promise.resolve(map)
                return
            }
            reactContext.contentResolver.openAssetFileDescriptor(uri, "r")?.use { afd ->
                val length = afd.length
                map.putBoolean("exists", length >= 0)
                map.putDouble("size", if (length >= 0) length.toDouble() else 0.0)
            } ?: run {
                map.putBoolean("exists", false)
                map.putDouble("size", 0.0)
            }
            promise.resolve(map)
        } catch (error: Exception) {
            promise.reject("E_STAT", error)
        }
    }

    private fun fileFromUri(uriString: String): File {
        val trimmed = uriString.trim()
        if (trimmed.startsWith("file://")) {
            val path = Uri.parse(trimmed).path ?: trimmed.removePrefix("file://")
            return File(path)
        }
        return File(trimmed)
    }

    private fun buildGalleryIntent(activity: Activity, mediaType: String?, multiple: Boolean): Intent {
        val dataTypes = when (mediaType) {
            "photo" -> listOf(MediaStore.Images.Media.EXTERNAL_CONTENT_URI to "image/*")
            "video" -> listOf(MediaStore.Video.Media.EXTERNAL_CONTENT_URI to "video/*")
            else -> listOf(
                MediaStore.Files.getContentUri("external") to "*/*",
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI to "*/*",
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI to "image/*",
            )
        }
        val pm = activity.packageManager
        val packages = GALLERY_PACKAGES + listOf(null)
        for (pkg in packages) {
            for ((uri, mime) in dataTypes) {
                val intent = Intent(Intent.ACTION_PICK)
                intent.setDataAndType(uri, mime)
                if (mediaType != "photo" && mediaType != "video") {
                    intent.putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*"))
                }
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple)
                if (pkg != null) intent.setPackage(pkg)
                if (intent.resolveActivity(pm) != null) return intent
            }
        }
        return Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI).apply {
            type = "image/*"
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple)
        }
    }

    private fun collectUris(data: Intent): List<Uri> {
        val uris = mutableListOf<Uri>()
        val clip = data.clipData
        if (clip != null) {
            for (i in 0 until clip.itemCount) {
                clip.getItemAt(i).uri?.let { uris.add(it) }
            }
        }
        if (uris.isEmpty()) {
            data.data?.let { uris.add(it) }
        }
        return uris
    }

    private fun copyToCache(uri: Uri): com.facebook.react.bridge.WritableMap? {
        val resolver = reactContext.contentResolver
        val mime = resolver.getType(uri) ?: guessMime(uri)
        val isVideo = mime.startsWith("video")
        val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime)
            ?: if (isVideo) "mp4" else "jpg"
        val outFile = File(reactContext.cacheDir, "gallery_${System.currentTimeMillis()}_$ext")
        resolver.openInputStream(uri)?.use { input ->
            FileOutputStream(outFile).use { output -> input.copyTo(output) }
        } ?: return null

        val map = Arguments.createMap()
        map.putString("uri", "file://${outFile.absolutePath}")
        map.putString("type", mime)
        map.putString("fileName", outFile.name)
        // Instant client validation: size + duration before JS compression/upload.
        map.putDouble("fileSize", outFile.length().toDouble())
        if (isVideo) {
            val durationSec = readVideoDurationSec(outFile.absolutePath)
            if (durationSec != null && durationSec > 0) {
                map.putDouble("duration", durationSec)
            }
        }
        return map
    }

    private fun readVideoDurationSec(path: String): Double? {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(path)
            val raw = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
            val ms = raw?.toLongOrNull() ?: return null
            if (ms <= 0L) null else ms / 1000.0
        } catch (_: Exception) {
            null
        } finally {
            try {
                retriever.release()
            } catch (_: Exception) {
                /* ignore */
            }
        }
    }

    private fun guessMime(uri: Uri): String {
        val path = uri.toString().lowercase()
        return if (path.contains("video") || path.endsWith(".mp4") || path.endsWith(".mov")) {
            "video/mp4"
        } else {
            "image/jpeg"
        }
    }

    companion object {
        const val NAME = "GalleryRollPicker"
        private const val REQUEST_CODE = 27181
        private val GALLERY_PACKAGES = listOf(
            "com.coloros.gallery3d",
            "com.oplus.gallery",
            "com.oppo.gallery3d",
            "com.oneplus.gallery",
            "com.google.android.apps.photos",
            "com.sec.android.gallery3d",
            "com.miui.gallery",
            "com.android.gallery3d",
        )
    }
}

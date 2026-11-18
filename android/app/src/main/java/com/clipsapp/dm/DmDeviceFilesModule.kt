package com.clipsapp.dm

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Size
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.io.FileOutputStream

/**
 * DM attachment sheet only. Lists recent camera-roll photos and videos,
 * and copies a picked document into app cache so the chat uploader can read it.
 */
class DmDeviceFilesModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    private var pickPromise: Promise? = null

    private val activityListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode != REQUEST_DOCUMENT) return
            val promise = pickPromise ?: return
            pickPromise = null
            if (resultCode != Activity.RESULT_OK || data?.data == null) {
                promise.resolve(null)
                return
            }
            try {
                promise.resolve(copyIntoCache(data.data!!, data.type))
            } catch (error: Exception) {
                promise.reject("PICK_FAILED", error.message, error)
            }
        }
    }

    init {
        reactContext.addActivityEventListener(activityListener)
    }

    override fun getName(): String = "DmDeviceFiles"

    override fun invalidate() {
        reactApplicationContext.removeActivityEventListener(activityListener)
        super.invalidate()
    }

    @ReactMethod
    fun recentMedia(limit: Int, promise: Promise) {
        val cap = limit.coerceIn(1, 40)
        Thread {
            try {
                val rows = ArrayList<RecentRow>()
                try {
                    rows.addAll(queryImages())
                } catch (_: Exception) {
                }
                try {
                    rows.addAll(queryVideos())
                } catch (_: Exception) {
                }
                rows.sortByDescending { it.dateAdded }
                val out: WritableArray = Arguments.createArray()
                for (row in rows.take(cap)) {
                    val map: WritableMap = Arguments.createMap()
                    map.putString("uri", row.uri.toString())
                    map.putString("mime", row.mime)
                    map.putString("name", row.name)
                    map.putBoolean("isVideo", row.isVideo)
                    map.putDouble("durationMs", row.durationMs.toDouble())
                    val thumb = writeThumb(row.uri)
                    if (thumb != null) map.putString("thumbUri", thumb)
                    out.pushMap(map)
                }
                promise.resolve(out)
            } catch (error: Exception) {
                promise.reject("RECENT_FAILED", error.message, error)
            }
        }.start()
    }

    @ReactMethod
    fun materialize(uriString: String, promise: Promise) {
        Thread {
            try {
                val uri = Uri.parse(uriString)
                if (uri.scheme == null || uri.scheme == "file") {
                    promise.resolve(uriString)
                    return@Thread
                }
                val copied = copyIntoCache(uri, reactApplicationContext.contentResolver.getType(uri))
                promise.resolve(copied.getString("uri"))
            } catch (error: Exception) {
                promise.reject("COPY_FAILED", error.message, error)
            }
        }.start()
    }

    @ReactMethod
    fun pickDocument(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Open a chat to pick a file")
            return
        }
        if (pickPromise != null) {
            promise.reject("BUSY", "A file picker is already open")
            return
        }
        pickPromise = promise
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        try {
            activity.startActivityForResult(intent, REQUEST_DOCUMENT)
        } catch (error: Exception) {
            pickPromise = null
            promise.reject("PICK_FAILED", error.message, error)
        }
    }

    private data class RecentRow(
        val uri: Uri,
        val mime: String,
        val name: String,
        val isVideo: Boolean,
        val durationMs: Long,
        val dateAdded: Long,
    )

    private fun queryImages(): List<RecentRow> {
        val projection = arrayOf(
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.MIME_TYPE,
            MediaStore.Images.Media.DISPLAY_NAME,
            MediaStore.Images.Media.DATE_ADDED,
        )
        val rows = ArrayList<RecentRow>()
        reactApplicationContext.contentResolver.query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            projection,
            null,
            null,
            "${MediaStore.Images.Media.DATE_ADDED} DESC",
        )?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
            val mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE)
            val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)
            val dateCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED)
            var count = 0
            while (cursor.moveToNext() && count < 40) {
                val id = cursor.getLong(idCol)
                rows.add(
                    RecentRow(
                        uri = Uri.withAppendedPath(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id.toString()),
                        mime = cursor.getString(mimeCol) ?: "image/jpeg",
                        name = cursor.getString(nameCol) ?: "photo.jpg",
                        isVideo = false,
                        durationMs = 0,
                        dateAdded = cursor.getLong(dateCol),
                    ),
                )
                count += 1
            }
        }
        return rows
    }

    private fun queryVideos(): List<RecentRow> {
        val projection = arrayOf(
            MediaStore.Video.Media._ID,
            MediaStore.Video.Media.MIME_TYPE,
            MediaStore.Video.Media.DISPLAY_NAME,
            MediaStore.Video.Media.DURATION,
            MediaStore.Video.Media.DATE_ADDED,
        )
        val rows = ArrayList<RecentRow>()
        reactApplicationContext.contentResolver.query(
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
            projection,
            null,
            null,
            "${MediaStore.Video.Media.DATE_ADDED} DESC",
        )?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID)
            val mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.MIME_TYPE)
            val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME)
            val durationCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION)
            val dateCol = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DATE_ADDED)
            var count = 0
            while (cursor.moveToNext() && count < 40) {
                val id = cursor.getLong(idCol)
                rows.add(
                    RecentRow(
                        uri = Uri.withAppendedPath(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id.toString()),
                        mime = cursor.getString(mimeCol) ?: "video/mp4",
                        name = cursor.getString(nameCol) ?: "video.mp4",
                        isVideo = true,
                        durationMs = cursor.getLong(durationCol),
                        dateAdded = cursor.getLong(dateCol),
                    ),
                )
                count += 1
            }
        }
        return rows
    }

    private fun writeThumb(uri: Uri): String? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
        return try {
            val bitmap = reactApplicationContext.contentResolver.loadThumbnail(uri, Size(256, 256), null)
            val dir = File(reactApplicationContext.cacheDir, "dm-thumbs").apply { mkdirs() }
            val file = File(dir, "thumb-${uri.toString().hashCode()}.jpg")
            FileOutputStream(file).use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 80, out)
            }
            bitmap.recycle()
            Uri.fromFile(file).toString()
        } catch (_: Exception) {
            null
        }
    }

    private fun copyIntoCache(uri: Uri, mimeHint: String?): WritableMap {
        val resolver = reactApplicationContext.contentResolver
        val mime = mimeHint ?: resolver.getType(uri) ?: "application/octet-stream"
        val name = displayName(uri) ?: fallbackName(mime)
        val safeName = name.replace(Regex("[^A-Za-z0-9._-]"), "_").take(80)
        val dir = File(reactApplicationContext.cacheDir, "dm-files").apply { mkdirs() }
        val dest = File(dir, "${System.currentTimeMillis()}-$safeName")
        resolver.openInputStream(uri).use { input ->
            if (input == null) throw IllegalStateException("Could not read that file")
            FileOutputStream(dest).use { output -> input.copyTo(output) }
        }
        val map = Arguments.createMap()
        map.putString("uri", Uri.fromFile(dest).toString())
        map.putString("mime", mime)
        map.putString("name", name)
        return map
    }

    private fun displayName(uri: Uri): String? {
        val projection = arrayOf(MediaStore.MediaColumns.DISPLAY_NAME)
        reactApplicationContext.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val index = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME)
                if (index >= 0) return cursor.getString(index)
            }
        }
        return uri.lastPathSegment
    }

    private fun fallbackName(mime: String): String {
        val ext = when {
            mime.startsWith("video/") -> "mp4"
            mime.startsWith("image/") -> "jpg"
            mime == "application/pdf" -> "pdf"
            else -> "bin"
        }
        return "file.$ext"
    }

    companion object {
        private const val REQUEST_DOCUMENT = 4817
    }
}

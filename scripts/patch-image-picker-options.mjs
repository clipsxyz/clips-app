/**
 * react-native-image-picker Options.java uses ReadableMap.getInt().
 * On RN 0.8x the JS bridge often sends numbers as Double, so getInt("durationLimit")
 * red-screens. Read ints defensively (hasKey + getDouble fallback).
 */
import fs from 'fs';
import path from 'path';

const file = path.join(
    process.cwd(),
    'node_modules/react-native-image-picker/android/src/main/java/com/imagepicker/Options.java',
);

const patched = `package com.imagepicker;

import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;

import android.text.TextUtils;

public class Options {
    int selectionLimit;
    Boolean includeBase64;
    Boolean includeExtra;
    int videoQuality = 1;
    int quality;
    int maxWidth;
    int maxHeight;
    Boolean saveToPhotos;
    int durationLimit;
    Boolean useFrontCamera = false;
    String mediaType;


    Options(ReadableMap options) {
        mediaType = options.hasKey("mediaType") ? options.getString("mediaType") : "photo";
        selectionLimit = readInt(options, "selectionLimit", 1);
        includeBase64 = readBoolean(options, "includeBase64", false);
        includeExtra = readBoolean(options, "includeExtra", false);

        String videoQualityString = options.hasKey("videoQuality") ? options.getString("videoQuality") : "high";
        if (!TextUtils.isEmpty(videoQualityString) && !videoQualityString.toLowerCase().equals("high")) {
            videoQuality = 0;
        }

        String cameraType = options.hasKey("cameraType") ? options.getString("cameraType") : "back";
        if ("front".equals(cameraType)) {
            useFrontCamera = true;
        }

        quality = (int) (readDouble(options, "quality", 1) * 100);
        maxHeight = readInt(options, "maxHeight", 0);
        maxWidth = readInt(options, "maxWidth", 0);
        saveToPhotos = readBoolean(options, "saveToPhotos", false);
        durationLimit = readInt(options, "durationLimit", 0);
    }

    private static int readInt(ReadableMap map, String key, int fallback) {
        if (map == null || !map.hasKey(key) || map.isNull(key)) {
            return fallback;
        }
        try {
            ReadableType type = map.getType(key);
            if (type == ReadableType.Number) {
                return (int) Math.round(map.getDouble(key));
            }
            if (type == ReadableType.String) {
                return (int) Math.round(Double.parseDouble(map.getString(key)));
            }
        } catch (Exception ignored) {
        }
        try {
            return map.getInt(key);
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private static double readDouble(ReadableMap map, String key, double fallback) {
        if (map == null || !map.hasKey(key) || map.isNull(key)) {
            return fallback;
        }
        try {
            return map.getDouble(key);
        } catch (Exception ignored) {
            try {
                return map.getInt(key);
            } catch (Exception ignored2) {
                return fallback;
            }
        }
    }

    private static boolean readBoolean(ReadableMap map, String key, boolean fallback) {
        if (map == null || !map.hasKey(key) || map.isNull(key)) {
            return fallback;
        }
        try {
            return map.getBoolean(key);
        } catch (Exception ignored) {
            return fallback;
        }
    }
}
`;

if (!fs.existsSync(file)) {
    console.warn('[patch-image-picker-options] skip (missing):', file);
    process.exit(0);
}

const current = fs.readFileSync(file, 'utf8');
if (current.includes('private static int readInt(')) {
    console.log('[patch-image-picker-options] already patched');
    process.exit(0);
}

fs.writeFileSync(file, patched);
console.log('[patch-image-picker-options] patched Options.java');

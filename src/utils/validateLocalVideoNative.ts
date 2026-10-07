import { Alert, Platform, ToastAndroid } from 'react-native';
import { toFfmpegPath, loadFfmpeg } from './ffmpegNative';
import { resolveLocalMediaUriForFfmpeg } from './resolveLocalMediaUriForFfmpegNative';
import { normalizeNativeUploadUri } from './uploadFileNative';
import { statLocalFileBytes } from './localFileNative';
import {
    MAX_FEED_VIDEO_DURATION_SEC,
    MAX_STORIES_VIDEO_DURATION_SEC,
    ensureFeedVideoUnderLimits,
} from './autoTrimVideoNative';

export {
    MAX_FEED_VIDEO_DURATION_SEC,
    MAX_STORIES_VIDEO_DURATION_SEC,
};

export type LocalVideoBounds = {
    uri: string;
    durationSec: number | null;
    sizeBytes: number | null;
};

export type LocalVideoValidationOk = {
    ok: true;
    bounds: LocalVideoBounds;
    uri?: string;
    wasTrimmed?: boolean;
};

export type LocalVideoValidationFail = {
    ok: false;
    reason: 'unreadable';
    message: string;
    bounds: LocalVideoBounds;
};

export type LocalVideoValidationResult = LocalVideoValidationOk | LocalVideoValidationFail;

function normalizeDurationHint(raw: unknown): number | null {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    const sec = n > 1000 ? n / 1000 : n;
    return Math.max(0.1, Math.floor(sec * 10) / 10);
}

/** Instant inline feedback (Toast on Android, Alert elsewhere). */
export function showVideoValidationFeedback(message: string): void {
    if (Platform.OS === 'android') {
        try {
            ToastAndroid.show(message, ToastAndroid.LONG);
            return;
        } catch {
            /* fall through */
        }
    }
    Alert.alert('Video', message);
}

export { statLocalFileBytes } from './localFileNative';

/**
 * Probe duration via FFmpeg banner logs when picker metadata is missing.
 */
export async function probeVideoDurationSec(uri: string): Promise<number | null> {
    try {
        const local = await resolveLocalMediaUriForFfmpeg(uri);
        const path = toFfmpegPath(local);
        const { FFmpegKit } = await loadFfmpeg();
        const session = await FFmpegKit.execute(`-hide_banner -i "${path}"`);
        const logs = (await session.getAllLogsAsString()) || '';
        const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i.exec(logs);
        if (!match) return null;
        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        const seconds = Number(match[3]);
        if (![hours, minutes, seconds].every((n) => Number.isFinite(n))) return null;
        return Math.max(0.1, Math.floor((hours * 3600 + minutes * 60 + seconds) * 10) / 10);
    } catch (err) {
        console.warn('[probeVideoDurationSec]', err);
        return null;
    }
}

export type ProbeLocalVideoHints = {
    durationSec?: number | null;
    fileSize?: number | null;
};

/** Resolve duration + byte size for a local clip (hints from ImagePicker preferred). */
export async function probeLocalVideoBounds(
    uri: string,
    hints: ProbeLocalVideoHints = {},
): Promise<LocalVideoBounds> {
    const normalized = normalizeNativeUploadUri(uri);
    let durationSec = normalizeDurationHint(hints.durationSec);
    let sizeBytes =
        typeof hints.fileSize === 'number' && Number.isFinite(hints.fileSize) && hints.fileSize >= 0
            ? hints.fileSize
            : null;

    if (sizeBytes == null) {
        sizeBytes = await statLocalFileBytes(normalized);
    }
    if (durationSec == null) {
        durationSec = await probeVideoDurationSec(normalized);
    }

    return { uri: normalized, durationSec, sizeBytes };
}

/**
 * Always hard-trims via ensureFeedVideoUnderLimits (FFmpeg first).
 * No client byte-size rejection — size is not a pre-trim gate.
 */
export async function validateLocalVideoForUpload(
    uri: string,
    hints: ProbeLocalVideoHints = {},
    options: { notifyTrim?: boolean } = {},
): Promise<LocalVideoValidationResult> {
    if (!uri?.trim()) {
        return {
            ok: false,
            reason: 'unreadable',
            message: 'No video selected.',
            bounds: { uri: '', durationSec: null, sizeBytes: null },
        };
    }

    const bounds = await probeLocalVideoBounds(uri, hints);

    try {
        const processed = await ensureFeedVideoUnderLimits(
            bounds.uri,
            {
                durationSec: bounds.durationSec,
                fileSize: bounds.sizeBytes,
            },
            { notify: options.notifyTrim !== false },
        );

        return {
            ok: true,
            bounds: {
                uri: processed.uri,
                durationSec: processed.durationSec,
                sizeBytes: processed.sizeBytes,
            },
            uri: processed.uri,
            wasTrimmed: processed.wasTrimmed,
        };
    } catch (err) {
        return {
            ok: false,
            reason: 'unreadable',
            message:
                err instanceof Error
                    ? err.message
                    : 'Could not prepare this video.',
            bounds,
        };
    }
}

/**
 * Pick-time filter only — never probe, size-check, or FFmpeg-encode here.
 */
export async function filterValidVideoAssets<
    T extends { uri?: string; type?: string; duration?: number; fileSize?: number },
>(assets: T[]): Promise<{ accepted: T[]; rejectedCount: number; trimmedCount: number }> {
    const accepted = assets.filter((asset) => !!asset.uri);
    return { accepted, rejectedCount: 0, trimmedCount: 0 };
}

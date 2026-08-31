import { NativeModules, Platform } from 'react-native';
import ImageCropPicker, { type Image as CropImage } from 'react-native-image-crop-picker';
import type { Asset } from 'react-native-image-picker';
import { ensureGalleryMediaPermission } from './galleryMediaPermissionsNative';

type GalleryRollItem = { uri?: string; type?: string; fileName?: string };

const GalleryRollPicker = NativeModules.GalleryRollPicker as
    | { open: (options: { multiple: boolean; mediaType: string }) => Promise<GalleryRollItem[]> }
    | undefined;

function toFileUri(path: string): string {
    const raw = String(path || '').trim();
    if (!raw) return '';
    if (/^(file:|content:|ph:)/i.test(raw)) return raw;
    return `file://${raw}`;
}

function cropImageToAsset(img: CropImage): Asset {
    const mime = String(img.mime || '');
    const durationRaw = Number(img.duration || 0);
    const durationSec = durationRaw > 1000 ? durationRaw / 1000 : durationRaw;
    const isVideo = mime.startsWith('video/') || /\.(mp4|mov|m4v|webm|3gp)$/i.test(img.path || '');
    return {
        uri: toFileUri(img.path),
        type: mime || (isVideo ? 'video/mp4' : 'image/jpeg'),
        fileName: img.filename || undefined,
        width: img.width,
        height: img.height,
        fileSize: img.size,
        duration: isVideo && durationSec > 0 ? durationSec : undefined,
    };
}

function isCancel(err: unknown): boolean {
    const code = String((err as { code?: string })?.code || '');
    const message = String((err as { message?: string })?.message || '');
    return (
        code === 'E_PICKER_CANCELLED' ||
        /cancel/i.test(message)
    );
}

/**
 * Open the device camera roll / Gallery app.
 * Android: ACTION_PICK against MediaStore (Oppo Gallery), not DocumentsUI Recents.
 * iOS: Photos library via image-crop-picker.
 */
export async function pickFromFullGallery(selectionLimit = 10): Promise<Asset[] | 'denied' | 'cancel'> {
    const allowed = await ensureGalleryMediaPermission();
    if (!allowed) return 'denied';

    const multiple = selectionLimit !== 1;

    if (Platform.OS === 'android' && GalleryRollPicker?.open) {
        try {
            const items = await GalleryRollPicker.open({ multiple, mediaType: 'any' });
            const assets = (items || [])
                .map((item) => ({
                    uri: item.uri,
                    type: item.type,
                    fileName: item.fileName,
                }))
                .filter((asset) => !!asset.uri) as Asset[];
            return assets.length > 0 ? assets.slice(0, Math.max(1, selectionLimit)) : 'cancel';
        } catch (err) {
            if (isCancel(err)) return 'cancel';
            console.warn('[pickFromFullGallery] GalleryRollPicker failed, falling back', err);
        }
    }

    try {
        const result = await ImageCropPicker.openPicker({
            mediaType: 'any',
            multiple,
            maxFiles: Math.max(1, selectionLimit),
            compressImageQuality: 0.9,
            smartAlbums: ['UserLibrary', 'Favorites', 'Videos', 'SelfPortraits', 'Screenshots'],
        });
        const list = Array.isArray(result) ? result : [result];
        return list.map(cropImageToAsset).filter((asset) => !!asset.uri);
    } catch (err) {
        if (isCancel(err)) return 'cancel';
        console.warn('[pickFromFullGallery]', err);
        throw err;
    }
}

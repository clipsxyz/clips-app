import { prepareMediaForPostNative } from './prepareMediaForPostNative';
import type { InstantFilterInfo } from './instantFiltersNative';

export type LocalCarouselItem = {
    uri: string;
    type: 'image' | 'video';
    /** Cover frame for this slide when type is video (seconds). */
    videoCoverTime?: number;
    durationSec?: number;
};

export type UploadedCarouselItem = {
    url: string;
    type: 'image' | 'video';
    duration?: number;
    /** Per-slide feed poster when type is video. */
    posterUrl?: string;
};

export type PrepareCarouselOptions = {
    filterInfo?: InstantFilterInfo | null;
    /** Applied when transcoding each video slide (gallery / composer parity). */
    videoFilterInfo?: InstantFilterInfo | null;
    /** @deprecated Use per-item videoCoverTime on LocalCarouselItem. */
    videoCoverTime?: number;
    /** Bakes filter on first image when provided. */
    captureVideoPoster?: () => Promise<string>;
};

export type PrepareCarouselResult = {
    items: UploadedCarouselItem[];
    /** Set when the first slide is a video. */
    videoPosterUrl?: string;
};

/**
 * Upload each carousel slide (images + MP4). Filter bake applies to the first image only.
 * Each video slide gets its own cover frame / poster.
 */
export async function prepareCarouselMediaForPostNative(
    items: LocalCarouselItem[],
    options: PrepareCarouselOptions = {},
): Promise<PrepareCarouselResult> {
    const {
        filterInfo,
        videoFilterInfo,
        videoCoverTime: legacyCoverTime = 0,
        captureVideoPoster,
    } = options;
    const uploaded: UploadedCarouselItem[] = [];
    let videoPosterUrl: string | undefined;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item?.uri) continue;

        const isFirst = i === 0;
        const slideCoverTime =
            item.type === 'video'
                ? item.videoCoverTime ?? (isFirst ? legacyCoverTime : 0)
                : 0;

        const slideVideoFilter =
            item.type === 'video' ? videoFilterInfo ?? null : null;
        const prep = await prepareMediaForPostNative({
            mediaUrl: item.uri,
            mediaType: item.type,
            filterInfo:
                item.type === 'image' && isFirst
                    ? filterInfo ?? null
                    : item.type === 'video'
                      ? slideVideoFilter
                      : null,
            captureVideoPoster:
                isFirst && (item.type === 'video' || (item.type === 'image' && filterInfo))
                    ? captureVideoPoster
                    : undefined,
            videoCoverTime: slideCoverTime,
        });

        if (!prep.mediaUrl) {
            throw new Error(`Failed to upload carousel slide ${i + 1}.`);
        }

        if (item.type === 'video' && prep.videoPosterUrl) {
            if (!videoPosterUrl) {
                videoPosterUrl = prep.videoPosterUrl;
            }
            uploaded.push({
                url: prep.mediaUrl,
                type: item.type,
                duration: item.durationSec,
                posterUrl: prep.videoPosterUrl,
            });
        } else {
            uploaded.push({
                url: prep.mediaUrl,
                type: item.type,
                duration: item.durationSec,
            });
        }
    }

    return { items: uploaded, videoPosterUrl };
}

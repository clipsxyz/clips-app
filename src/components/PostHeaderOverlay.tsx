import React, { useEffect, useMemo, useState } from 'react';
import { FiList } from 'react-icons/fi';
import type { Post } from '../types';
import { timeAgo } from '../utils/timeAgo';

export type PostCarouselMeta = {
    venue?: string;
    time?: string;
    landmark?: string;
};

type CarouselItem = {
    key: 'location' | 'venue' | 'landmark' | 'time';
    label: string;
    /** Feed switch target when tapped; null for non-navigable items (e.g. time). */
    feedFilter: 'location' | 'venue' | 'landmark' | null;
};

type PostOverlaySource = Pick<Post, 'locationLabel' | 'venue' | 'landmark' | 'createdAt'> & {
    carousel_meta?: PostCarouselMeta | null;
    carouselMeta?: PostCarouselMeta | null;
};

type Props = {
    locationLabel?: string | null;
    carouselMeta?: PostCarouselMeta | null;
    /** When carouselMeta is omitted, derive venue/time from the post (incl. carousel_meta). */
    post?: PostOverlaySource | null;
    onLocationPress?: (
        label: string,
        filterType?: 'location' | 'venue' | 'landmark',
    ) => void;
    /** Post options (burger) — sits top-right of the media. */
    onOverflowPress?: () => void;
    /** Extra classes for the absolute header row (e.g. top offset under avatar chrome). */
    className?: string;
};

function resolveCarouselMeta(
    carouselMeta: PostCarouselMeta | null | undefined,
    post: Props['post'],
): PostCarouselMeta | null {
    return carouselMeta || post?.carouselMeta || post?.carousel_meta || null;
}

/** Left broadcast badge slides: location → venue → landmark → time. */
function buildCarouselItems(
    locationLabel: string | null | undefined,
    carouselMeta: PostCarouselMeta | null | undefined,
    post: Props['post'],
): CarouselItem[] {
    const items: CarouselItem[] = [];
    const location = String(locationLabel || post?.locationLabel || '').trim();
    if (location && location !== 'Unknown Location') {
        items.push({ key: 'location', label: location, feedFilter: 'location' });
    }
    const meta = resolveCarouselMeta(carouselMeta, post);
    const venue = String(meta?.venue || post?.venue || '').trim();
    if (venue) items.push({ key: 'venue', label: venue, feedFilter: 'venue' });
    const landmark = String(meta?.landmark || post?.landmark || '').trim();
    if (landmark && landmark !== venue) {
        items.push({ key: 'landmark', label: landmark, feedFilter: 'landmark' });
    }
    let time = String(meta?.time || '').trim();
    if (!time && post?.createdAt != null) {
        const ts =
            typeof post.createdAt === 'string' ? parseInt(post.createdAt, 10) : post.createdAt;
        if (typeof ts === 'number' && !Number.isNaN(ts)) {
            time = timeAgo(ts);
        }
    }
    if (time) items.push({ key: 'time', label: time, feedFilter: null });
    return items;
}

/**
 * Broadcast-style left badge carousel + top-right overflow (web).
 */
export default function PostHeaderOverlay({
    locationLabel,
    carouselMeta,
    post,
    onLocationPress,
    onOverflowPress,
    className = '',
}: Props) {
    const items = useMemo(
        () => buildCarouselItems(locationLabel, carouselMeta, post),
        [
            locationLabel,
            carouselMeta,
            post?.locationLabel,
            post?.venue,
            post?.landmark,
            post?.createdAt,
            post?.carouselMeta,
            post?.carousel_meta,
        ],
    );
    const itemsKey = items.map((i) => `${i.key}:${i.label}`).join('|');
    const [index, setIndex] = useState(0);

    useEffect(() => {
        setIndex(0);
    }, [itemsKey]);

    useEffect(() => {
        if (items.length <= 1) return;
        const t = setInterval(() => {
            setIndex((i) => (i + 1) % items.length);
        }, 3000);
        return () => clearInterval(t);
    }, [items.length, itemsKey]);

    const active = items[index] ?? items[0] ?? null;
    if (!active && !onOverflowPress) return null;

    const canPress = Boolean(onLocationPress && active?.feedFilter);

    return (
        <div
            className={`pointer-events-none absolute inset-x-0 z-[20] flex items-start justify-between gap-2 px-2.5 pt-2.5 ${className || 'top-0'}`.trim()}
        >
            {active ? (
                <button
                    key={`${active.key}-${index}`}
                    type="button"
                    className="metadata-carousel-slide-left pointer-events-auto inline-flex max-w-[72%] items-center gap-1.5 rounded-full border border-white/20 bg-[rgba(18,24,27,0.85)] px-2.5 py-1.5 text-left transition-opacity hover:opacity-90 disabled:opacity-100"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!onLocationPress || !active.feedFilter) return;
                        onLocationPress(active.label, active.feedFilter);
                    }}
                    disabled={!canPress}
                    aria-label={canPress ? `Switch feed to ${active.label}` : active.label}
                >
                    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                        <span className="absolute h-3 w-3 animate-ping rounded-full border-[1.5px] border-[#EF4444] bg-transparent" />
                        <span className="relative h-2 w-2 rounded-full bg-[#EF4444]" />
                    </span>
                    <span className="truncate text-[10px] font-extrabold uppercase tracking-[0.14em] text-white">
                        {active.label}
                    </span>
                </button>
            ) : (
                <span />
            )}

            {onOverflowPress ? (
                <button
                    type="button"
                    className="pointer-events-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-[rgba(18,24,27,0.55)] text-white transition-opacity hover:opacity-90"
                    onClick={(e) => {
                        e.stopPropagation();
                        onOverflowPress();
                    }}
                    aria-label="Post options"
                    title="Post options"
                >
                    <FiList className="h-4 w-4" />
                </button>
            ) : null}
        </div>
    );
}

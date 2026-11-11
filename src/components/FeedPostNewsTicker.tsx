import React, { useEffect, useRef, useState } from 'react';
import { FiClock, FiEye, FiHome, FiMapPin, FiUser } from 'react-icons/fi';
import { GiGreekTemple } from 'react-icons/gi';
import type { Post } from '../types';
import {
    buildFeedPostNewsTicker,
    tickerSlideCount,
    TICKER_SEGMENT_GAP,
    type NewsTickerSegment,
    type NewsTickerSegmentKind,
} from '../utils/feedPostNewsTicker';

type Props = {
    post: Post;
    carouselIndex?: number;
};

function segmentKicker(kind: NewsTickerSegmentKind): string {
    switch (kind) {
        case 'location':
            return 'Place';
        case 'venue':
            return 'Venue';
        case 'landmark':
            return 'Landmark';
        case 'tagged':
            return 'Tagged';
        case 'views':
            return 'Views';
        case 'timestamp':
            return 'Posted';
        case 'author':
        default:
            return 'Author';
    }
}

function SegmentIcon({ kind }: { kind: NewsTickerSegmentKind }) {
    const className = 'h-2 w-2 text-white';
    switch (kind) {
        case 'location':
            return <FiMapPin className={className} aria-hidden />;
        case 'venue':
            return <FiHome className={className} aria-hidden />;
        case 'landmark':
            return <GiGreekTemple className={className} aria-hidden />;
        case 'tagged':
            return <FiUser className={className} aria-hidden />;
        case 'views':
            return <FiEye className={className} aria-hidden />;
        case 'timestamp':
            return <FiClock className={className} aria-hidden />;
        case 'author':
        default:
            return <FiUser className={className} aria-hidden />;
    }
}

function Segments({ segments, passKey }: { segments: NewsTickerSegment[]; passKey: string }) {
    return (
        <>
            {segments.map((segment, idx) => (
                <React.Fragment key={`${passKey}-${segment.kind}-${idx}`}>
                    {idx > 0 ? <span className="shrink-0 text-[9px] font-semibold tracking-wide text-white">{TICKER_SEGMENT_GAP}</span> : null}
                    <span className="flex shrink-0 items-center pl-1 pr-1.5">
                        <span className="mr-1 flex h-3.5 w-3.5 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/15">
                            <SegmentIcon kind={segment.kind} />
                        </span>
                        <span className="flex shrink-0 flex-col justify-center">
                            <span className="text-[6px] font-bold uppercase leading-[7px] tracking-wide text-white/70">
                                {segmentKicker(segment.kind)}
                            </span>
                            <span className="text-[9px] font-bold leading-[11px] text-white">
                                {segment.text}
                            </span>
                        </span>
                    </span>
                </React.Fragment>
            ))}
        </>
    );
}

/** Scrolling place / venue / time strip under the postcard, matching the APK ticker. */
export default function FeedPostNewsTicker({ post, carouselIndex = 0 }: Props) {
    const slideCount = tickerSlideCount(post);
    const data = buildFeedPostNewsTicker(post, carouselIndex, slideCount >= 2 ? slideCount : undefined);
    const measureRef = useRef<HTMLDivElement>(null);
    const [shift, setShift] = useState(0);

    useEffect(() => {
        const el = measureRef.current;
        if (!el) return;
        const update = () => setShift(el.offsetWidth);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, [data.content]);

    const duration = Math.max(10000, shift * 36);

    return (
        <div className="relative h-[22px] w-full overflow-hidden bg-black/60" aria-label={data.content}>
            <div
                className="absolute left-2 top-0 flex h-full items-center"
                style={{
                    ['--ticker-shift' as string]: shift > 0 ? `-${shift}px` : '0px',
                    animation: shift > 0 ? `feedPostNewsTicker ${duration}ms linear infinite` : 'none',
                }}
            >
                <div ref={measureRef} className="flex shrink-0 items-center">
                    <Segments segments={data.segments} passKey="a" />
                    <span className="shrink-0 text-[9px] font-semibold tracking-wide text-white">{TICKER_SEGMENT_GAP}</span>
                </div>
                <div className="flex shrink-0 items-center" aria-hidden>
                    <Segments segments={data.segments} passKey="b" />
                </div>
            </div>
        </div>
    );
}

import React from 'react';
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion';
import { IoLogoInstagram } from 'react-icons/io5';
import capcutAppIcon from '../assets/capcut-app-icon.jpg';

function TikTokGlyph() {
    return (
        <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="#FFFFFF" aria-hidden>
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
        </svg>
    );
}

/** Simplified Instagram Edits mark — the PNG asset is nearly black on this pill. */
function InstagramEditsGlyph() {
    const raw = React.useId().replace(/:/g, '');
    const left = `editsLeft-${raw}`;
    const right = `editsRight-${raw}`;
    return (
        <svg width={26} height={26} viewBox="0 0 24 24" aria-hidden>
            <defs>
                <linearGradient id={left} x1="4" y1="20" x2="4" y2="4">
                    <stop offset="0" stopColor="#8134af" />
                    <stop offset="0.5" stopColor="#dd2a7b" />
                    <stop offset="1" stopColor="#f58529" />
                </linearGradient>
                <linearGradient id={right} x1="20" y1="4" x2="20" y2="20">
                    <stop offset="0" stopColor="#f9d423" />
                    <stop offset="0.5" stopColor="#f58529" />
                    <stop offset="1" stopColor="#dd2a7b" />
                </linearGradient>
            </defs>
            <rect x={1} y={1} width={22} height={22} rx={5.5} fill="#141414" stroke="rgba(255,255,255,0.22)" strokeWidth={0.6} />
            <path d="M7.2 6.5c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2" stroke={`url(#${left})`} strokeWidth={1.8} strokeLinecap="round" fill="none" />
            <rect x={10.8} y={6.2} width={2.4} height={11.6} rx={1.2} fill="#FFFFFF" />
            <path d="M16.8 6.5c1.1 0 2 .9 2 2v7c0 1.1-.9 2-2 2" stroke={`url(#${right})`} strokeWidth={1.8} strokeLinecap="round" fill="none" />
        </svg>
    );
}

export type CreateSourceKey = 'tiktok' | 'instagram' | 'capcut' | 'edits';

export type CreateSourceAppsCarouselProps = {
    onExplainTap: (sourceKey?: CreateSourceKey) => void;
    /** Static label on the right side of the pill (Google Lens–style). */
    shareLabel?: string;
    /** Replaces default styling on the outer wrapper. */
    className?: string;
};

const SOURCES: Array<{ key: CreateSourceKey; label: string }> = [
    { key: 'tiktok', label: 'TikTok' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'capcut', label: 'CapCut' },
    { key: 'edits', label: 'Instagram Edits' },
];

function SourceMark({ sourceKey }: { sourceKey: CreateSourceKey }) {
    if (sourceKey === 'tiktok') {
        return (
            <span className="flex h-[26px] w-[26px] items-center justify-center overflow-hidden rounded-full bg-black">
                <TikTokGlyph />
            </span>
        );
    }
    if (sourceKey === 'instagram') {
        return (
            <span className="flex h-[26px] w-[26px] items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white">
                <IoLogoInstagram size={15} color="#FFFFFF" />
            </span>
        );
    }
    if (sourceKey === 'capcut') {
        return (
            <span className="flex h-[26px] w-[26px] items-center justify-center overflow-hidden rounded-full border border-white/[0.28] bg-[#111827]">
                <img src={capcutAppIcon} alt="" draggable={false} className="h-full w-full object-cover" />
            </span>
        );
    }
    return (
        <span className="flex h-[26px] w-[26px] items-center justify-center overflow-hidden rounded-full border border-white/[0.28] bg-[#111827]">
            <InstagramEditsGlyph />
        </span>
    );
}

/** Logo strip step — compact like Lens. */
const SLOT_PX = 34;
const VELOCITY_PROJECTION = 0.2;
const AUTO_ADVANCE_MS = 2600;

/**
 * Google Lens–style pill: rotating circular logos on the left, fixed label on the right.
 * Drag horizontally or auto-advance; tap logos or label opens gallery tips.
 */
export default function CreateSourceAppsCarousel({
    onExplainTap,
    shareLabel = 'Upload',
    className,
}: CreateSourceAppsCarouselProps) {
    const count = SOURCES.length;
    const [index, setIndex] = React.useState(0);
    const indexRef = React.useRef(0);
    const x = useMotionValue(0);
    const draggingRef = React.useRef(false);
    const pausedRef = React.useRef(false);

    const snapX = React.useCallback((i: number) => -Math.max(0, Math.min(count - 1, i)) * SLOT_PX, [count]);

    const snapToIndex = React.useCallback(
        (i: number) => {
            const clamped = Math.max(0, Math.min(count - 1, i));
            indexRef.current = clamped;
            setIndex(clamped);
            void animate(x, snapX(clamped), { type: 'spring', stiffness: 420, damping: 36, mass: 0.62 });
        },
        [count, snapX, x],
    );

    const onDragEnd = React.useCallback(
        (_evt: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
            draggingRef.current = false;
            const vx = info.velocity.x;
            const minX = -(count - 1) * SLOT_PX;
            const clampedX = Math.max(minX, Math.min(0, x.get()));
            const projected = clampedX + vx * VELOCITY_PROJECTION;
            let next = Math.round(-projected / SLOT_PX);
            next = Math.max(0, Math.min(count - 1, next));
            snapToIndex(next);
        },
        [count, snapToIndex, x],
    );

    React.useEffect(() => {
        const id = window.setInterval(() => {
            if (draggingRef.current || pausedRef.current) return;
            setIndex((prev) => {
                const next = (prev + 1) % count;
                indexRef.current = next;
                void animate(x, snapX(next), { type: 'spring', stiffness: 420, damping: 36, mass: 0.62 });
                return next;
            });
        }, AUTO_ADVANCE_MS);
        return () => window.clearInterval(id);
    }, [count, snapX, x]);

    const active = SOURCES[index];

    const explainActive = () => onExplainTap(SOURCES[indexRef.current]?.key);

    const lensPillClass =
        'flex items-center rounded-full border border-white bg-[#0F172A] py-1 pl-1 pr-4 shadow-[0_2px_10px_rgba(0,0,0,0.45)]';

    return (
        <div
            className={className ?? 'pointer-events-auto flex justify-center outline-none'}
            onMouseEnter={() => {
                pausedRef.current = true;
            }}
            onMouseLeave={() => {
                pausedRef.current = false;
            }}
        >
            {/* Lens-style pill */}
            <div
                className={lensPillClass}
                role="group"
                aria-label={`${shareLabel}, ${active.label}. Swipe the logo to switch app.`}
            >
                <div
                    className="relative shrink-0 overflow-hidden rounded-full bg-black/35 ring-[0.5px] ring-white/10"
                    style={{ width: SLOT_PX, height: SLOT_PX }}
                    aria-hidden
                >
                    <motion.div
                        drag="x"
                        dragConstraints={{ left: -(count - 1) * SLOT_PX, right: 0 }}
                        dragElastic={0.06}
                        onTap={explainActive}
                        onDragStart={() => {
                            draggingRef.current = true;
                            pausedRef.current = true;
                        }}
                        onDragEnd={onDragEnd}
                        className="flex cursor-grab touch-pan-x active:cursor-grabbing"
                        style={{
                            x,
                            width: count * SLOT_PX,
                            height: SLOT_PX,
                        }}
                    >
                        {SOURCES.map((item) => (
                            <div
                                key={item.key}
                                className="flex shrink-0 items-center justify-center"
                                style={{ width: SLOT_PX, height: SLOT_PX }}
                                title={item.label}
                            >
                                <SourceMark sourceKey={item.key} />
                            </div>
                        ))}
                    </motion.div>
                </div>

                <button
                    type="button"
                    className="ml-2 bg-transparent py-0.5 text-[15px] font-normal leading-none tracking-[-0.2px] text-white antialiased hover:text-white focus:outline-none focus-visible:underline"
                    onClick={(e) => {
                        e.stopPropagation();
                        explainActive();
                    }}
                >
                    {shareLabel}
                </button>
            </div>
        </div>
    );
}

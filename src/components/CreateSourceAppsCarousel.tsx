import React from 'react';
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion';
import { SiInstagram, SiTiktok } from 'react-icons/si';
import instagramEditsAppIcon from '../assets/instagram-edits-app-icon.png';
import capcutAppIcon from '../assets/capcut-app-icon.jpg';

/** Official-style Instagram Edits app mark (App Store artwork). */
function InstagramEditsGlyph({ className }: { className?: string }) {
    return (
        <img
            src={instagramEditsAppIcon}
            alt=""
            draggable={false}
            className={`rounded-[22%] object-cover ${className ?? ''}`}
        />
    );
}

/** CapCut app icon (Apple App Store artwork via iTunes Search API). */
function CapCutGlyph({ className }: { className?: string }) {
    return (
        <img
            src={capcutAppIcon}
            alt=""
            draggable={false}
            className={`rounded-[22%] object-cover ${className ?? ''}`}
        />
    );
}

export type CreateSourceAppsCarouselProps = {
    onExplainTap: () => void;
    /** Static label on the right side of the pill (Google Lens–style). */
    shareLabel?: string;
    /** Replaces default styling on the outer wrapper. */
    className?: string;
};

const SOURCES: Array<{
    key: string;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    wrapClass: string;
}> = [
    {
        key: 'tiktok',
        label: 'TikTok',
        Icon: SiTiktok,
        wrapClass: 'bg-black text-white',
    },
    {
        key: 'instagram',
        label: 'Instagram',
        Icon: SiInstagram,
        wrapClass: 'bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white',
    },
    {
        key: 'capcut',
        label: 'CapCut',
        Icon: CapCutGlyph,
        wrapClass: 'bg-neutral-950 ring-[0.5px] ring-white/15',
    },
    {
        key: 'instagram-edits',
        label: 'Instagram Edits',
        Icon: InstagramEditsGlyph,
        wrapClass: 'bg-neutral-950 ring-[0.5px] ring-white/18',
    },
];

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
    const x = useMotionValue(0);
    const draggingRef = React.useRef(false);
    const pausedRef = React.useRef(false);

    const snapX = React.useCallback((i: number) => -Math.max(0, Math.min(count - 1, i)) * SLOT_PX, [count]);

    const snapToIndex = React.useCallback(
        (i: number) => {
            const clamped = Math.max(0, Math.min(count - 1, i));
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
                void animate(x, snapX(next), { type: 'spring', stiffness: 420, damping: 36, mass: 0.62 });
                return next;
            });
        }, AUTO_ADVANCE_MS);
        return () => window.clearInterval(id);
    }, [count, snapX, x]);

    const active = SOURCES[index];

    const lensPillClass =
        'flex items-center rounded-full border border-white/[0.09] bg-[#3c4043]/92 py-1 pl-1 pr-4 shadow-[0_2px_10px_rgba(0,0,0,0.45)] backdrop-blur-md';

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
                className={`${lensPillClass} focus-within:ring-2 focus-within:ring-white/25`}
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
                        onTap={onExplainTap}
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
                        {SOURCES.map((item) => {
                            const Icon = item.Icon;
                            return (
                                <div
                                    key={item.key}
                                    className="flex shrink-0 items-center justify-center"
                                    style={{ width: SLOT_PX, height: SLOT_PX }}
                                    title={item.label}
                                >
                                    <span
                                        className={`flex h-[26px] w-[26px] items-center justify-center rounded-full shadow-md ${item.wrapClass}`}
                                    >
                                        <Icon className="h-[15px] w-[15px]" />
                                    </span>
                                </div>
                            );
                        })}
                    </motion.div>
                </div>

                <button
                    type="button"
                    className="ml-2 bg-transparent py-0.5 text-[15px] font-normal leading-none tracking-tight text-white antialiased hover:text-white focus:outline-none focus-visible:underline"
                    onClick={(e) => {
                        e.stopPropagation();
                        onExplainTap();
                    }}
                >
                    {shareLabel}
                </button>
            </div>
        </div>
    );
}

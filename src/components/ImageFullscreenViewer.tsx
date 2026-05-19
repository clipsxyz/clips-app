import React from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiHeart, FiMessageCircle, FiRepeat, FiSend, FiMoreHorizontal, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export type ImageFullscreenItem = {
  url: string;
};

export type ImageFullscreenOriginRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type ImageFullscreenEngagement = {
  postId: string;
  likes: number;
  comments: number;
  shares: number;
  reclips: number;
  userLiked: boolean;
  userReclipped: boolean;
  userHandle: string;
  currentUserHandle?: string;
  onLike: () => void | Promise<void>;
  onComment: () => void;
  onReclip: () => void | Promise<void>;
  onShare: () => void;
};

type ImageFullscreenViewerProps = {
  images: ImageFullscreenItem[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  originRect?: ImageFullscreenOriginRect | null;
  engagement?: ImageFullscreenEngagement;
  onMenu?: () => void;
};

/** Match Stories 24 rail expand/collapse on feed. */
const EXPAND_MS = 560;
const COLLAPSE_MS = 720;
const EXPAND_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const COLLAPSE_EASE = 'cubic-bezier(0.34, 1.28, 0.32, 1)';

const chromeBtn =
  'p-2.5 rounded-full bg-black/50 text-white hover:bg-black/65 active:bg-black/75 transition-colors backdrop-blur-sm';

type MotionPhase = 'idle' | 'start' | 'expand' | 'collapse';

/**
 * Threads-style fullscreen still-image viewer (not Scenes).
 * Opens/closes with the same card → fullscreen motion as Stories 24 on the feed.
 */
export default function ImageFullscreenViewer({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
  originRect,
  engagement,
  onMenu,
}: ImageFullscreenViewerProps) {
  const [index, setIndex] = React.useState(initialIndex);
  const [liked, setLiked] = React.useState(engagement?.userLiked ?? false);
  const [likes, setLikes] = React.useState(engagement?.likes ?? 0);
  const [comments, setComments] = React.useState(engagement?.comments ?? 0);
  const [shares, setShares] = React.useState(engagement?.shares ?? 0);
  const [reclips, setReclips] = React.useState(engagement?.reclips ?? 0);
  const [userReclipped, setUserReclipped] = React.useState(engagement?.userReclipped ?? false);
  const [motionPhase, setMotionPhase] = React.useState<MotionPhase>('idle');
  const [viewport, setViewport] = React.useState({ w: 0, h: 0 });
  const originRectRef = React.useRef<ImageFullscreenOriginRect | null>(null);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = React.useRef<number | null>(null);

  const hasOrigin = Boolean(originRect && originRect.width > 8 && originRect.height > 8);
  const isExpanded = motionPhase === 'expand';

  React.useEffect(() => {
    const read = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  React.useEffect(() => {
    if (isOpen) setIndex(initialIndex);
  }, [isOpen, initialIndex]);

  React.useEffect(() => {
    if (!engagement) return;
    setLiked(engagement.userLiked);
    setLikes(engagement.likes);
    setComments(engagement.comments);
    setShares(engagement.shares);
    setReclips(engagement.reclips);
    setUserReclipped(engagement.userReclipped);
  }, [
    engagement?.userLiked,
    engagement?.likes,
    engagement?.comments,
    engagement?.shares,
    engagement?.reclips,
    engagement?.userReclipped,
  ]);

  React.useEffect(() => {
    if (!isOpen || !engagement?.postId) return;
    const pid = engagement.postId;
    const onLike = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.liked != null) setLiked(d.liked);
      if (typeof d?.likes === 'number') setLikes(d.likes);
    };
    const onComment = () => setComments((c) => c + 1);
    const onShare = () => setShares((s) => s + 1);
    const onReclip = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (typeof d?.reclips === 'number') setReclips(d.reclips);
      else setReclips((r) => r + 1);
      setUserReclipped(true);
    };
    window.addEventListener(`likeToggled-${pid}`, onLike as EventListener);
    window.addEventListener(`commentAdded-${pid}`, onComment);
    window.addEventListener(`shareAdded-${pid}`, onShare);
    window.addEventListener(`reclipAdded-${pid}`, onReclip as EventListener);
    return () => {
      window.removeEventListener(`likeToggled-${pid}`, onLike as EventListener);
      window.removeEventListener(`commentAdded-${pid}`, onComment);
      window.removeEventListener(`shareAdded-${pid}`, onShare);
      window.removeEventListener(`reclipAdded-${pid}`, onReclip as EventListener);
    };
  }, [isOpen, engagement?.postId]);

  React.useEffect(() => {
    if (!isOpen) {
      setMotionPhase('idle');
      return;
    }

    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (originRect) {
      originRectRef.current = originRect;
    }

    if (!hasOrigin || reducedMotion) {
      setMotionPhase('expand');
      return;
    }

    setMotionPhase('start');
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => setMotionPhase('expand'));
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [isOpen, hasOrigin, originRect]);

  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const finishClose = React.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    onClose();
  }, [onClose]);

  const requestClose = React.useCallback(() => {
    if (closeTimerRef.current) return;

    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const origin = originRectRef.current;
    if (!origin || reducedMotion) {
      finishClose();
      return;
    }

    if (engagement?.postId) {
      const el = document.querySelector(`[data-feed-post-media="${CSS.escape(engagement.postId)}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        const r = el.getBoundingClientRect();
        if (r.width > 8 && r.height > 8) {
          originRectRef.current = {
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
          };
        }
      }
    }

    setMotionPhase('collapse');
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      finishClose();
    }, COLLAPSE_MS);
  }, [finishClose, engagement?.postId]);

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
      if (e.key === 'ArrowLeft' && images.length > 1) {
        setIndex((i) => (i - 1 + images.length) % images.length);
      }
      if (e.key === 'ArrowRight' && images.length > 1) {
        setIndex((i) => (i + 1) % images.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, images.length, requestClose]);

  if (!isOpen || images.length === 0 || viewport.w < 1) return null;

  const safeIndex = Math.min(Math.max(index, 0), images.length - 1);
  const current = images[safeIndex];
  const hasMultiple = images.length > 1;
  const canReclip = engagement && engagement.userHandle !== engagement.currentUserHandle;
  const origin = originRectRef.current;
  const useMotionShell = Boolean(origin && hasOrigin);

  const shellTop = useMotionShell && !isExpanded ? origin!.top : 0;
  const shellLeft = useMotionShell && !isExpanded ? origin!.left : 0;
  const shellWidth = useMotionShell && !isExpanded ? origin!.width : viewport.w;
  const shellHeight = useMotionShell && !isExpanded ? origin!.height : viewport.h;
  const shellRadius = useMotionShell && !isExpanded ? 16 : 0;
  const transitionMs = motionPhase === 'collapse' ? COLLAPSE_MS : EXPAND_MS;
  const transitionEase = motionPhase === 'collapse' ? COLLAPSE_EASE : EXPAND_EASE;
  const backdropOpacity =
    motionPhase === 'expand' ? 1 : motionPhase === 'collapse' ? 0.28 : 0;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!hasMultiple || touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX == null) return;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 48) return;
    if (dx < 0) setIndex((i) => (i + 1) % images.length);
    else setIndex((i) => (i - 1 + images.length) % images.length);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen image"
      className="fixed inset-0 z-[210]"
      style={{ height: '100dvh', width: '100vw' }}
    >
      <div
        className="absolute inset-0 transition-opacity"
        style={{
          backgroundColor: '#000',
          opacity: backdropOpacity,
          transitionDuration: `${transitionMs}ms`,
          transitionTimingFunction: transitionEase,
          pointerEvents: isExpanded ? 'auto' : 'none',
        }}
        onClick={isExpanded ? requestClose : undefined}
        aria-hidden={!isExpanded}
      />

      <div
        className="absolute overflow-hidden bg-black shadow-[0_20px_60px_rgba(0,0,0,0.45)] transition-[top,left,width,height,border-radius] will-change-[top,left,width,height,border-radius]"
        style={{
          top: shellTop,
          left: shellLeft,
          width: shellWidth,
          height: shellHeight,
          borderRadius: shellRadius,
          transitionDuration: `${transitionMs}ms`,
          transitionTimingFunction: transitionEase,
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex h-full w-full flex-col">
          <header
            className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2"
            style={{
              opacity: isExpanded ? 1 : 0,
              transition: `opacity ${transitionMs}ms ${transitionEase}`,
              pointerEvents: isExpanded ? 'auto' : 'none',
            }}
          >
            <button type="button" onClick={requestClose} className={chromeBtn} aria-label="Close">
              <FiX size={22} strokeWidth={2.25} />
            </button>
            <div className="flex items-center gap-2">
              {hasMultiple && (
                <span className="text-sm font-medium text-white/75 tabular-nums px-2">
                  {safeIndex + 1} / {images.length}
                </span>
              )}
              {onMenu && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMenu();
                  }}
                  className={chromeBtn}
                  aria-label="More options"
                >
                  <FiMoreHorizontal size={22} strokeWidth={2.25} />
                </button>
              )}
            </div>
          </header>

          <main
            className="absolute inset-0 flex items-center justify-center"
            style={{
              paddingTop: isExpanded ? 'max(3.5rem, calc(env(safe-area-inset-top) + 2.75rem))' : 0,
              paddingBottom: isExpanded && engagement
                ? 'max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))'
                : 0,
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {isExpanded && hasMultiple && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => (i - 1 + images.length) % images.length);
                }}
                className={`absolute left-2 top-1/2 z-30 -translate-y-1/2 ${chromeBtn}`}
                aria-label="Previous image"
              >
                <FiChevronLeft size={26} />
              </button>
            )}

            <img
              src={current.url}
              alt=""
              className={`w-full h-full select-none pointer-events-none ${
                isExpanded ? 'object-contain' : 'object-cover'
              }`}
              draggable={false}
            />

            {isExpanded && hasMultiple && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => (i + 1) % images.length);
                }}
                className={`absolute right-2 top-1/2 z-30 -translate-y-1/2 ${chromeBtn}`}
                aria-label="Next image"
              >
                <FiChevronRight size={26} />
              </button>
            )}
          </main>

          {engagement && (
            <footer
              className="absolute bottom-0 left-0 right-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
              style={{
                opacity: isExpanded ? 1 : 0,
                transition: `opacity ${transitionMs}ms ${transitionEase}`,
                pointerEvents: isExpanded ? 'auto' : 'none',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-7">
                <button
                  type="button"
                  className="flex items-center gap-2 min-h-[44px] text-white"
                  onClick={() => void engagement.onLike()}
                  aria-pressed={liked}
                  aria-label={liked ? 'Unlike' : 'Like'}
                >
                  <FiHeart
                    size={26}
                    className={liked ? 'fill-white text-white' : 'text-white'}
                    strokeWidth={liked ? 0 : 1.75}
                  />
                  <span className="text-[15px] font-normal tabular-nums">{likes}</span>
                </button>

                <button
                  type="button"
                  className="flex items-center gap-2 min-h-[44px] text-white"
                  onClick={engagement.onComment}
                  aria-label="Comments"
                >
                  <FiMessageCircle size={26} strokeWidth={1.75} />
                  <span className="text-[15px] font-normal tabular-nums">{comments}</span>
                </button>

                <button
                  type="button"
                  className={`flex items-center gap-2 min-h-[44px] ${canReclip && !userReclipped ? 'text-white' : 'text-white/35'}`}
                  onClick={() => canReclip && !userReclipped && void engagement.onReclip()}
                  disabled={!canReclip || userReclipped}
                  aria-label="Reclip"
                >
                  <FiRepeat size={26} strokeWidth={1.75} className={userReclipped ? 'text-cyan-400' : undefined} />
                  <span className="text-[15px] font-normal tabular-nums">{reclips}</span>
                </button>

                <button
                  type="button"
                  className="flex items-center min-h-[44px] text-white ml-auto"
                  onClick={engagement.onShare}
                  aria-label="Share"
                >
                  <FiSend size={24} strokeWidth={1.75} />
                </button>
              </div>
            </footer>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

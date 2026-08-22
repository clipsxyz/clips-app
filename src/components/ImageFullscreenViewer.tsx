import React from 'react';
import { createPortal } from 'react-dom';
import {
  FiX,
  FiHeart,
  FiMessageCircle,
  FiRepeat,
  FiShare2,
  FiMoreVertical,
  FiChevronLeft,
  FiChevronRight,
  FiBookmark,
  FiBarChart2,
  FiArrowLeft,
} from 'react-icons/fi';
import { getAvatarForHandle } from '../api/users';

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
  saves?: number;
  views?: number;
  userLiked: boolean;
  userReclipped: boolean;
  userHandle: string;
  currentUserHandle?: string;
  isFollowing?: boolean;
  viewerAvatarUrl?: string;
  viewerName?: string;
  onLike: () => void | Promise<void>;
  onComment: () => void;
  onReclip: () => void | Promise<void>;
  onShare: () => void;
  onFollow?: () => void | Promise<void>;
  onSave?: () => void;
  isSaved?: boolean;
  onVisitProfile?: () => void;
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

type MotionPhase = 'idle' | 'start' | 'expand' | 'collapse';

function compactCount(n: number | undefined): string {
  const v = Math.max(0, Number(n) || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(v);
}

function displayNameFromHandle(handle: string): string {
  const raw = String(handle || '').trim();
  if (!raw) return 'User';
  return raw.split('@')[0] || raw;
}

function atHandle(handle: string): string {
  const raw = String(handle || '').trim();
  if (!raw) return '';
  return raw.startsWith('@') ? raw : `@${raw}`;
}

/**
 * Twitter/X-style fullscreen still-image viewer.
 * Opens/closes with feed card → fullscreen motion; tap image toggles chrome.
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
  const [views, setViews] = React.useState(engagement?.views ?? 0);
  const [userReclipped, setUserReclipped] = React.useState(engagement?.userReclipped ?? false);
  const [following, setFollowing] = React.useState(engagement?.isFollowing ?? false);
  const [chromeVisible, setChromeVisible] = React.useState(true);
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
    if (isOpen) {
      setIndex(initialIndex);
      setChromeVisible(true);
    }
  }, [isOpen, initialIndex]);

  React.useEffect(() => {
    if (!engagement) return;
    setLiked(engagement.userLiked);
    setLikes(engagement.likes);
    setComments(engagement.comments);
    setShares(engagement.shares);
    setReclips(engagement.reclips);
    setViews(engagement.views ?? 0);
    setUserReclipped(engagement.userReclipped);
    setFollowing(engagement.isFollowing ?? false);
  }, [
    engagement?.userLiked,
    engagement?.likes,
    engagement?.comments,
    engagement?.shares,
    engagement?.reclips,
    engagement?.views,
    engagement?.userReclipped,
    engagement?.isFollowing,
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
  const isOwn =
    Boolean(engagement?.userHandle) &&
    Boolean(engagement?.currentUserHandle) &&
    engagement!.userHandle === engagement!.currentUserHandle;
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

  const authorHandle = engagement?.userHandle || '';
  const authorName = displayNameFromHandle(authorHandle);
  const authorAt = atHandle(authorHandle);
  const authorAvatar = authorHandle ? getAvatarForHandle(authorHandle) : undefined;
  const viewerAvatar =
    engagement?.viewerAvatarUrl ||
    (engagement?.currentUserHandle ? getAvatarForHandle(engagement.currentUserHandle) : undefined);
  const showChrome = isExpanded && chromeVisible;

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

  const onImageSurfaceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded) return;
    setChromeVisible((v) => !v);
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
        <div className="relative flex h-full w-full flex-col bg-black">
          {/* Image stage — tap toggles chrome */}
          <main
            className="relative flex min-h-0 flex-1 items-center justify-center"
            style={{
              paddingTop: showChrome ? 'max(3.25rem, calc(env(safe-area-inset-top) + 2.5rem))' : 'env(safe-area-inset-top)',
              paddingBottom: showChrome && engagement ? '9.5rem' : 'env(safe-area-inset-bottom)',
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={onImageSurfaceClick}
          >
            {showChrome && hasMultiple && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => (i - 1 + images.length) % images.length);
                }}
                className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white"
                aria-label="Previous image"
              >
                <FiChevronLeft size={26} />
              </button>
            )}

            <img
              src={current.url}
              alt=""
              className={`h-full w-full select-none pointer-events-none ${
                isExpanded ? 'object-contain' : 'object-cover'
              }`}
              draggable={false}
            />

            {showChrome && hasMultiple && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => (i + 1) % images.length);
                }}
                className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white"
                aria-label="Next image"
              >
                <FiChevronRight size={26} />
              </button>
            )}
          </main>

          {/* X-style header */}
          {engagement && (
            <header
              className="absolute top-0 left-0 right-0 z-40 flex items-center gap-1 px-1.5 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]"
              style={{
                opacity: showChrome ? 1 : 0,
                transition: `opacity ${transitionMs}ms ${transitionEase}`,
                pointerEvents: showChrome ? 'auto' : 'none',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.72), rgba(0,0,0,0))',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={requestClose}
                className="flex h-10 w-10 items-center justify-center text-white"
                aria-label="Close"
              >
                <FiArrowLeft size={22} strokeWidth={2.25} />
              </button>

              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => engagement.onVisitProfile?.()}
                disabled={!engagement.onVisitProfile}
              >
                {authorAvatar ? (
                  <img
                    src={authorAvatar}
                    alt=""
                    className="h-[34px] w-[34px] shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gray-700 text-xs font-semibold text-white">
                    {authorName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold text-white">{authorName}</span>
                  <span className="block truncate text-[13px] text-[#8B98A5]">{authorAt}</span>
                </span>
              </button>

              {!isOwn && engagement.onFollow ? (
                <button
                  type="button"
                  onClick={() => {
                    void Promise.resolve(engagement.onFollow?.()).then(() => {
                      setFollowing((f) => !f);
                    });
                  }}
                  className="mr-1 rounded-full border border-white/80 px-3.5 py-1.5 text-[13px] font-bold text-white"
                >
                  {following ? 'Following' : 'Follow'}
                </button>
              ) : null}

              {onMenu ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMenu();
                  }}
                  className="flex h-10 w-10 items-center justify-center text-white"
                  aria-label="More options"
                >
                  <FiMoreVertical size={20} strokeWidth={2.25} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={requestClose}
                  className="flex h-10 w-10 items-center justify-center text-white"
                  aria-label="Close"
                >
                  <FiX size={20} />
                </button>
              )}
            </header>
          )}

          {showChrome && hasMultiple ? (
            <div className="pointer-events-none absolute right-4 top-[max(3.25rem,calc(env(safe-area-inset-top)+2.75rem))] z-40 rounded-full bg-black/45 px-2 py-1 text-xs font-semibold text-white tabular-nums">
              {safeIndex + 1}/{images.length}
            </div>
          ) : null}

          {/* Engagement + reply (X) */}
          {engagement && (
            <div
              className="absolute bottom-0 left-0 right-0 z-40"
              style={{
                opacity: showChrome ? 1 : 0,
                transition: `opacity ${transitionMs}ms ${transitionEase}`,
                pointerEvents: showChrome ? 'auto' : 'none',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
                <button
                  type="button"
                  className="flex min-h-9 items-center gap-1.5 text-[#8B98A5]"
                  onClick={engagement.onComment}
                  aria-label="Reply"
                >
                  <FiMessageCircle size={20} strokeWidth={1.75} />
                  <span className="text-[13px] tabular-nums">{compactCount(comments)}</span>
                </button>
                <button
                  type="button"
                  className={`flex min-h-9 items-center gap-1.5 ${
                    userReclipped ? 'text-[#00BA7C]' : 'text-[#8B98A5]'
                  } ${!canReclip || userReclipped ? 'opacity-40' : ''}`}
                  onClick={() => canReclip && !userReclipped && void engagement.onReclip()}
                  disabled={!canReclip || userReclipped}
                  aria-label="Reclip"
                >
                  <FiRepeat size={20} strokeWidth={1.75} />
                  <span className="text-[13px] tabular-nums">{compactCount(reclips)}</span>
                </button>
                <button
                  type="button"
                  className={`flex min-h-9 items-center gap-1.5 ${liked ? 'text-[#F91880]' : 'text-[#8B98A5]'}`}
                  onClick={() => void engagement.onLike()}
                  aria-pressed={liked}
                  aria-label={liked ? 'Unlike' : 'Like'}
                >
                  <FiHeart
                    size={20}
                    className={liked ? 'fill-current' : undefined}
                    strokeWidth={liked ? 0 : 1.75}
                  />
                  <span className="text-[13px] tabular-nums">{compactCount(likes)}</span>
                </button>
                <span className="flex min-h-9 items-center gap-1.5 text-[#8B98A5]" aria-label="Views">
                  <FiBarChart2 size={20} strokeWidth={1.75} />
                  <span className="text-[13px] tabular-nums">{compactCount(views || shares)}</span>
                </span>
                {engagement.onSave ? (
                  <button
                    type="button"
                    className={`flex min-h-9 items-center gap-1.5 ${
                      engagement.isSaved ? 'text-[#1D9BF0]' : 'text-[#8B98A5]'
                    }`}
                    onClick={engagement.onSave}
                    aria-label={engagement.isSaved ? 'Saved' : 'Save'}
                  >
                    <FiBookmark
                      size={20}
                      className={engagement.isSaved ? 'fill-current' : undefined}
                      strokeWidth={engagement.isSaved ? 0 : 1.75}
                    />
                    <span className="text-[13px] tabular-nums">
                      {compactCount(
                        Math.max(
                          Number(engagement.saves) || 0,
                          engagement.isSaved ? 1 : 0,
                        ),
                      )}
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  className="flex min-h-9 w-7 items-center justify-center text-[#8B98A5]"
                  onClick={engagement.onShare}
                  aria-label="Share"
                >
                  <FiShare2 size={20} strokeWidth={1.75} />
                </button>
              </div>

              <div className="flex items-center gap-2.5 border-t border-white/10 px-3.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2">
                {viewerAvatar ? (
                  <img
                    src={viewerAvatar}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700 text-[10px] font-semibold text-white">
                    {(engagement.viewerName || 'Y').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  onClick={engagement.onComment}
                  className="flex min-h-10 flex-1 items-center rounded-full bg-[#16181C] px-3.5 text-left"
                >
                  <span className="flex-1 text-[15px] text-[#8B98A5]">Post your reply</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

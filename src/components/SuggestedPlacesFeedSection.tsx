import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronRight, FiInfo, FiSliders } from 'react-icons/fi';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';
import type { Post } from '../types';
import {
  emitSuggestedPlacesAnalytics,
  reasonExplanation,
  type PlaceMatchedPost,
  type PlaceSuggestionReason,
} from '../utils/suggestedPlaces';

const VIDEO_URL_RE = /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i;

function isVideoUrl(url: string): boolean {
  return VIDEO_URL_RE.test(url);
}

/** First carousel / legacy field suitable for strip preview; marks video vs image so MP4 is not rendered as img. */
function postThumbVisual(p: PlaceMatchedPost['post']): { url: string; isVideo: boolean } | undefined {
  const items = p.mediaItems?.filter((m) => m.url && m.type !== 'text');
  if (items && items.length > 0) {
    const videoItem =
      items.find((m) => m.type === 'video') || items.find((m) => m.url && isVideoUrl(m.url));
    if (videoItem?.url) return { url: videoItem.url, isVideo: true };
    const imgItem = items.find((m) => m.type === 'image');
    if (imgItem?.url) return { url: imgItem.url, isVideo: isVideoUrl(imgItem.url) };
    const first = items[0];
    if (first?.url) return { url: first.url, isVideo: isVideoUrl(first.url) };
  }
  const url = p.mediaUrl || p.finalVideoUrl;
  if (!url) return undefined;
  const isVideo =
    p.mediaType === 'video' || isVideoUrl(url) || (!!p.finalVideoUrl && url === p.finalVideoUrl);
  return { url, isVideo };
}

const STRIP_VIDEO_LOOP_SEC = 3;

function SuggestedStripPreviewVideo({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLVideoElement>(null);

  const onTimeUpdate = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const limit =
      el.duration > 0 && Number.isFinite(el.duration)
        ? Math.min(STRIP_VIDEO_LOOP_SEC, el.duration)
        : STRIP_VIDEO_LOOP_SEC;
    if (el.currentTime >= limit - 0.05) {
      el.currentTime = 0;
    }
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      className={className}
      muted
      playsInline
      autoPlay
      preload="metadata"
      onTimeUpdate={onTimeUpdate}
      onLoadedData={(e) => {
        void e.currentTarget.play().catch(() => {});
      }}
    />
  );
}

function scrollToFeedPost(
  postId: string,
  analytics?: { matchedPlace: string; reason: PlaceSuggestionReason; bundleKey: string }
) {
  const id = String(postId);
  try {
    const esc =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(id)
        : id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const el = document.querySelector(`[data-feed-post-id="${esc}"]`) as HTMLElement | null;
    if (!el) return;
    if (analytics) {
      emitSuggestedPlacesAnalytics({
        action: 'jump_to_post',
        postId: id,
        matchedPlace: analytics.matchedPlace,
        reason: analytics.reason,
        bundleKey: analytics.bundleKey,
      });
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const highlight = [
      'ring-2',
      'ring-cyan-400/90',
      'ring-offset-2',
      'ring-offset-[#030712]',
      'shadow-[0_0_0_1px_rgba(34,211,238,0.35)]',
    ] as const;
    el.classList.add(...highlight);
    window.setTimeout(() => {
      el.classList.remove(...highlight);
    }, 2200);
  } catch {
    /* ignore */
  }
}

function normalizeHandleKey(v: string) {
  return String(v || '')
    .replace(/^@/, '')
    .trim()
    .toLowerCase();
}

export type SuggestedPlacesFeedSectionProps = {
  bundleKey: string;
  suggestions: PlaceMatchedPost[];
  /** Logged-in user handle (no @) — hides Follow on own posts. */
  viewerHandle?: string | null;
  includePosterLocale: boolean;
  /** Same behavior as main feed Follow — includes private / pending / Laravel. */
  onFollowPost?: (post: Post) => void | Promise<void>;
};

export default function SuggestedPlacesFeedSection({
  bundleKey,
  suggestions,
  viewerHandle = null,
  includePosterLocale,
  onFollowPost,
}: SuggestedPlacesFeedSectionProps) {
  const navigate = useNavigate();
  const [followBusyId, setFollowBusyId] = React.useState<string | null>(null);
  const [hiddenPostIds, setHiddenPostIds] = React.useState<Set<string>>(new Set());
  const [expandedWhyPostId, setExpandedWhyPostId] = React.useState<string | null>(null);
  const [lastHidden, setLastHidden] = React.useState<{ postId: string; matchedPlace: string } | null>(null);

  const persistPlaceFeedback = React.useCallback((storageKey: string, place: string) => {
    try {
      const raw = localStorage.getItem(storageKey);
      const current = raw ? (JSON.parse(raw) as string[]) : [];
      const next = [...new Set([...current, place.trim()])].slice(0, 40);
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const removePlaceFeedback = React.useCallback((storageKey: string, place: string) => {
    try {
      const raw = localStorage.getItem(storageKey);
      const current = raw ? (JSON.parse(raw) as string[]) : [];
      const target = place.trim().toLowerCase();
      const next = current.filter((p) => String(p).trim().toLowerCase() !== target);
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const visibleSuggestions = React.useMemo(
    () => suggestions.filter(({ post }) => !hiddenPostIds.has(String(post.id))),
    [suggestions, hiddenPostIds]
  );

  React.useEffect(() => {
    emitSuggestedPlacesAnalytics({
      action: 'strip_view',
      bundleKey,
      suggestionCount: suggestions.length,
      includePosterRegionalNational: includePosterLocale,
    });
  }, [bundleKey, suggestions.length, includePosterLocale]);

  if (!visibleSuggestions.length) return null;

  return (
    <section
      className="mx-3 mb-4 rounded-3xl border border-[#363636] bg-[#121212] p-3 shadow-[0_2px_12px_rgba(0,0,0,0.45)]"
      aria-label="Suggested posts based on your places"
    >
      <div className="flex items-start justify-between gap-2 mb-3 px-0.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white tracking-tight">Users from places you like</h3>
          <p className="text-[11px] text-[#8e8e8e] mt-1 leading-snug">Based on places you selected.</p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            navigate('/preferences/locations');
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#363636] bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/85 hover:bg-white/10 transition-colors"
          aria-label="Adjust location suggestions"
        >
          <FiSliders className="h-3.5 w-3.5" aria-hidden />
          Adjust
        </button>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
        {visibleSuggestions.map(({ post, matchedPlace, reason, confidence }) => {
          const avatar = getAvatarForHandle(post.userHandle);
          const isOwn =
            !!viewerHandle &&
            normalizeHandleKey(post.userHandle) === normalizeHandleKey(viewerHandle);
          const following = !!post.isFollowing;
          const busy = followBusyId === String(post.id);
          const openProfile = () => {
            navigate(`/user/${post.userHandle}`);
          };
          const onFollowClick = async (e: React.MouseEvent) => {
            e.stopPropagation();
            if (!onFollowPost || isOwn) return;
            const id = String(post.id);
            setFollowBusyId(id);
            try {
              await onFollowPost(post);
            } finally {
              setFollowBusyId((cur) => (cur === id ? null : cur));
            }
          };
          const whyOpen = expandedWhyPostId === String(post.id);
          return (
            <article
              key={String(post.id)}
              className="shrink-0 w-[165px] rounded-2xl border border-[#30363d] bg-[#0d1318] p-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openProfile();
                }}
                className="w-full"
              >
                <div className="mb-2.5 flex justify-center">
                  <Avatar src={avatar} name={post.userHandle} size={94} className="!rounded-full ring-1 ring-white/10" />
                </div>
                <p className="truncate text-center text-[15px] font-semibold text-white leading-tight">{post.userHandle}</p>
                <p className="mt-0.5 truncate text-center text-[12px] text-[#8e8e8e]">{matchedPlace}</p>
                <p className="mt-0.5 text-center text-[11px] text-[#8e8e8e]">Suggested for you</p>
              </button>

              {!isOwn && onFollowPost ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onFollowClick}
                  className={`mt-3 w-full rounded-xl py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                    following
                      ? 'border border-[#3a3a3a] bg-transparent text-white hover:bg-white/5'
                      : 'bg-[#4f68ff] text-white hover:bg-[#6077ff]'
                  }`}
                >
                  {busy ? 'Saving…' : following ? 'Following' : 'Follow'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    scrollToFeedPost(String(post.id), {
                      matchedPlace,
                      reason,
                      bundleKey,
                    })
                  }
                  className="mt-3 w-full rounded-xl bg-[#4f68ff] py-2 text-sm font-semibold text-white hover:bg-[#6077ff] transition-colors"
                >
                  Open
                </button>
              )}

              <div className="mt-1.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setExpandedWhyPostId((cur) => (cur === String(post.id) ? null : String(post.id)))}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-white/75 hover:text-white"
                >
                  <FiInfo className="w-3 h-3" aria-hidden />
                  Why this?
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHiddenPostIds((prev) => new Set([...prev, String(post.id)]));
                    persistPlaceFeedback('clips:suggestedPlacesDislikedPlaces', matchedPlace);
                    setLastHidden({ postId: String(post.id), matchedPlace });
                    emitSuggestedPlacesAnalytics({
                      action: 'not_interested_post',
                      postId: String(post.id),
                      matchedPlace,
                      reason,
                      bundleKey,
                    });
                  }}
                  className="text-[10px] font-medium text-white/55 hover:text-white/85"
                >
                  Not interested
                </button>
              </div>
              {whyOpen && (
                <p className="mt-1 text-[10px] leading-snug text-[#b8b8b8]">
                  {reasonExplanation(reason, matchedPlace, confidence)}
                </p>
              )}
            </article>
          );
        })}
      </div>

      {lastHidden && (
        <div className="mt-2 flex items-center justify-between rounded-xl border border-[#363636] bg-black/35 px-2.5 py-2 text-[11px]">
          <span className="text-[#bdbdbd] truncate pr-3">Hidden suggestions like {lastHidden.matchedPlace}</span>
          <button
            type="button"
            onClick={() => {
              setHiddenPostIds((prev) => {
                const next = new Set(prev);
                next.delete(lastHidden.postId);
                return next;
              });
              removePlaceFeedback('clips:suggestedPlacesDislikedPlaces', lastHidden.matchedPlace);
              setLastHidden(null);
            }}
            className="shrink-0 rounded-lg border border-[#4c4c4c] px-2 py-1 text-white/90 hover:bg-white/10"
          >
            Undo
          </button>
        </div>
      )}

    </section>
  );
}

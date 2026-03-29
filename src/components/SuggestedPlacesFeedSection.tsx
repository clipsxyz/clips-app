import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronRight, FiX } from 'react-icons/fi';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';
import type { Post } from '../types';
import {
  emitSuggestedPlacesAnalytics,
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
  onToggleIncludePosterLocale: (enabled: boolean) => void;
  onDismissRow: () => void;
  /** Same behavior as main feed Follow — includes private / pending / Laravel. */
  onFollowPost?: (post: Post) => void | Promise<void>;
};

export default function SuggestedPlacesFeedSection({
  bundleKey,
  suggestions,
  viewerHandle = null,
  includePosterLocale,
  onToggleIncludePosterLocale,
  onDismissRow,
  onFollowPost,
}: SuggestedPlacesFeedSectionProps) {
  const navigate = useNavigate();
  const [followBusyId, setFollowBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    emitSuggestedPlacesAnalytics({
      action: 'strip_view',
      bundleKey,
      suggestionCount: suggestions.length,
      includePosterRegionalNational: includePosterLocale,
    });
  }, [bundleKey, suggestions.length, includePosterLocale]);

  if (!suggestions.length) return null;

  return (
    <section
      className="mx-3 mb-4 rounded-3xl border border-[#363636] bg-[#121212] p-3 shadow-[0_2px_12px_rgba(0,0,0,0.45)]"
      aria-label="Suggested posts based on your places"
    >
      <div className="flex items-start justify-between gap-2 mb-3 px-0.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white tracking-tight">Suggested for your places</h3>
          <p className="text-[11px] text-[#8e8e8e] mt-1 leading-snug">
            From your location, travels, and bio — matched to post venues and places.
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onDismissRow();
          }}
          className="shrink-0 p-1 rounded-full text-[#a8a8a8] hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Hide this suggestion row"
        >
          <FiX className="w-4 h-4" aria-hidden />
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-0.5 px-0.5">
        {suggestions.map(({ post, matchedPlace, reason }) => {
          const thumb = postThumbVisual(post);
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
          return (
            <div
              key={String(post.id)}
              className="shrink-0 w-[158px] text-left rounded-3xl border border-[#363636] bg-[#121212] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.35)] flex flex-col"
            >
              <div className="p-[2px] bg-gradient-to-tr from-teal-400 via-sky-500 to-fuchsia-500 rounded-t-3xl">
                <div className="relative aspect-[4/5] bg-[#0a0a0a] rounded-[1.125rem] overflow-hidden">
                  <button
                    type="button"
                    className="absolute inset-0 z-0 cursor-pointer"
                    onClick={() =>
                      scrollToFeedPost(String(post.id), {
                        matchedPlace,
                        reason,
                        bundleKey,
                      })
                    }
                    aria-label="Jump to post in feed"
                  />
                  {thumb ? (
                    thumb.isVideo ? (
                      <SuggestedStripPreviewVideo
                        src={thumb.url}
                        className="absolute inset-0 z-[1] w-full h-full object-cover pointer-events-none"
                      />
                    ) : (
                      <img
                        src={thumb.url}
                        alt=""
                        className="absolute inset-0 z-[1] w-full h-full object-cover pointer-events-none"
                        loading="lazy"
                      />
                    )
                  ) : (
                    <div className="absolute inset-0 z-[1] flex items-center justify-center text-[10px] text-[#8e8e8e] px-2 text-center pointer-events-none">
                      {post.text?.slice(0, 80) || post.caption?.slice(0, 80) || 'Clip'}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/45 to-transparent pt-8 pb-1.5 px-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openProfile();
                      }}
                      className="flex items-center gap-1.5 min-w-0 w-full text-left rounded-lg py-0.5 -mx-0.5 px-0.5 hover:bg-white/10 active:bg-white/15 transition-colors"
                      aria-label={`View profile ${post.userHandle}`}
                    >
                      <Avatar src={avatar} name={post.userHandle} size="sm" className="!w-[22px] !h-[22px] !text-[9px] ring-1 ring-black/60 shrink-0" />
                      <span className="text-[11px] font-semibold text-white truncate">{post.userHandle}</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="px-2.5 pb-3 pt-2 space-y-1.5 flex-1 flex flex-col">
                <p className="text-[11px] font-semibold text-white truncate" title={matchedPlace}>
                  {matchedPlace}
                </p>
                {!isOwn && onFollowPost ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onFollowClick}
                    className={`w-full py-1.5 rounded-xl text-[11px] font-semibold transition-colors active:scale-[0.98] disabled:opacity-60 ${
                      following
                        ? 'border border-[#363636] bg-transparent text-white hover:bg-white/5'
                        : 'bg-[#0095f6] text-white hover:bg-[#1877f2]'
                    }`}
                  >
                    {busy ? 'Saving…' : following ? 'Following' : 'Follow'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    scrollToFeedPost(String(post.id), {
                      matchedPlace,
                      reason,
                      bundleKey,
                    })
                  }
                  className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#0095f6] hover:text-[#67b9ff] mt-auto text-left"
                >
                  Jump to post
                  <FiChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 pt-3 border-t border-[#363636] space-y-3">
        <div className="flex items-start gap-2.5 select-none">
          <button
            type="button"
            role="switch"
            aria-checked={includePosterLocale}
            aria-label="Broader matching: include poster region and country"
            onClick={() => onToggleIncludePosterLocale(!includePosterLocale)}
            className={`mt-0.5 relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
              includePosterLocale ? 'bg-[#0095f6]' : 'bg-[#363636]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                includePosterLocale ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
          <div className="text-[11px] text-[#a8a8a8] leading-snug">
            <span className="text-white/90 font-medium">Broader matching</span>
            <span className="block mt-0.5 text-[#8e8e8e]">
              Also use each poster’s region and country (more results; may feel less specific).
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

import React from 'react';
import { IoChevronForward, IoClose, IoPlay } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';
import { resolveMockFeedVideoUrl } from '../constants/mockFeedVideos';
import { rewriteMediaUrlForClient } from '../api/apiBaseUrl';
import type { Post } from '../types';
import { emitSuggestedPlacesAnalytics } from '../utils/suggestedPlaces';
import { activityContextLabel, featuredPreviewFromPost } from '../utils/suggestedFollowerFeed';

type LocalBusinessSuggestionCardProps = {
  posts: Post[];
  userLocal?: string;
  useMockBusinesses?: boolean;
  pinnedPaidPostId?: string;
  viewerHandle?: string | null;
  viewerRegional?: string | null;
  onFollowPost?: (post: Post) => void | Promise<void>;
  onHideBusiness?: (businessKey: string) => void;
  onUnhideBusiness?: (businessKey: string) => void;
  onLikeBusiness?: (businessKey: string) => void;
};

const VIDEO_SRC_RE = /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i;

function formatViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function PreviewVideo({ src, poster }: { src: string; poster?: string }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const onTimeUpdate = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const limit = el.duration > 0 && Number.isFinite(el.duration) ? Math.min(1, el.duration) : 1;
    if (el.currentTime >= limit - 0.05) el.currentTime = 0;
  }, []);
  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      className="h-full w-full object-cover"
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

function jumpToPost(postId: string) {
  const id = String(postId);
  try {
    const esc =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(id)
        : id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const el = document.querySelector(`[data-feed-post-id="${esc}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {
    /* ignore */
  }
}

type BusinessCardModel = {
  id: string;
  name: string;
  subtitle: string;
  avatarSrc?: string;
  handle?: string;
  postId?: string;
  post?: Post;
  isFollowing?: boolean;
  isOwn?: boolean;
  canViewProfile?: boolean;
};

function normalizeHandle(v: string | null | undefined): string {
  return String(v || '').replace(/^@/, '').trim().toLowerCase();
}

function mockBusinessAvatar(name: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0d1318&color=8ab4ff&rounded=true&bold=true&size=256&format=png`;
}

export default function LocalBusinessSuggestionCard({
  posts,
  userLocal,
  useMockBusinesses = false,
  pinnedPaidPostId,
  viewerHandle = null,
  viewerRegional = null,
  onFollowPost: _onFollowPost,
  onHideBusiness,
  onUnhideBusiness,
  onLikeBusiness: _onLikeBusiness,
}: LocalBusinessSuggestionCardProps) {
  const navigate = useNavigate();
  const [locallyHiddenBusinesses, setLocallyHiddenBusinesses] = React.useState<Set<string>>(new Set());
  const [lastHiddenBusiness, setLastHiddenBusiness] = React.useState<string | null>(null);
  const cardRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const seenImpressionsRef = React.useRef<Set<string>>(new Set());
  if (!posts.length) {
    return (
      <section className="mx-3 mb-4 rounded-3xl border border-[#363636] bg-[#121212] p-3 shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
        <h3 className="text-sm font-semibold text-white tracking-tight">Local businesses you might like</h3>
        <p className="mt-2 text-[12px] text-[#8e8e8e]">No strong local business matches yet. Check back soon.</p>
      </section>
    );
  }
  const fallbackLocal = userLocal || 'your area';

  const mockBusinesses: BusinessCardModel[] = React.useMemo(
    () => [
      { id: 'mock-biz-1', name: `${fallbackLocal} Coffee Co`, subtitle: `Suggested in ${fallbackLocal}`, mock: true },
      { id: 'mock-biz-2', name: `${fallbackLocal} Fitness Hub`, subtitle: `Suggested in ${fallbackLocal}`, mock: true },
      { id: 'mock-biz-3', name: `${fallbackLocal} Hair Studio`, subtitle: `Suggested in ${fallbackLocal}`, mock: true },
      { id: 'mock-biz-4', name: `${fallbackLocal} Pizza Kitchen`, subtitle: `Suggested in ${fallbackLocal}`, mock: true },
    ],
    [fallbackLocal]
  );

  const businessCards: BusinessCardModel[] = React.useMemo(() => {
    const isBusinessAuthor = (post: Post) => post.userAccountType === 'business';

    if (useMockBusinesses) {
      const viewer = normalizeHandle(viewerHandle);
      const businessSources = posts.filter((post) => {
        const handle = normalizeHandle(post.userHandle);
        if (!handle || handle === viewer) return false;
        return isBusinessAuthor(post);
      });
      const sourcePool = businessSources;

      return mockBusinesses.map((mock, idx) => {
        const source = sourcePool.length > 0 ? sourcePool[idx % sourcePool.length] : undefined;
        return {
          ...mock,
          avatarSrc: mockBusinessAvatar(mock.name),
          // Mock cards should still open a profile when tapping "View".
          // Prefer business-like authors and never route to the current viewer.
          handle: source?.userHandle,
          postId: source ? String(source.id) : undefined,
          post: source,
          isFollowing: false,
          isOwn: false,
          canViewProfile: Boolean(source?.userHandle),
        };
      });
    }
    return posts.filter((post) => isBusinessAuthor(post)).slice(0, 8).map((post) => {
      const own = normalizeHandle(post.userHandle) === normalizeHandle(viewerHandle);
      return {
      id: String(post.id),
      name: post.venue || post.landmark || post.userHandle,
      subtitle: activityContextLabel({ local: userLocal, regional: viewerRegional || undefined }, post),
      avatarSrc: getAvatarForHandle(post.userHandle),
      handle: post.userHandle,
      postId: String(post.id),
      post,
      isFollowing: post.isFollowing,
      isOwn: own,
      canViewProfile: Boolean(post.userHandle) && !own,
    };
    });
  }, [useMockBusinesses, mockBusinesses, posts, userLocal, viewerHandle, viewerRegional]);
  const visibleBusinessCards = React.useMemo(
    () =>
      businessCards.filter((card) => {
        if (!card.canViewProfile) return false;
        const key = normalizeHandle(card.handle);
        return !key || !locallyHiddenBusinesses.has(key);
      }),
    [businessCards, locallyHiddenBusinesses]
  );

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
          const node = entry.target as HTMLElement;
          const id = node.dataset.businessCardId;
          const idx = Number(node.dataset.businessCardIndex || -1);
          const postId = node.dataset.businessPostId || undefined;
          if (!id || seenImpressionsRef.current.has(id)) continue;
          seenImpressionsRef.current.add(id);
          const isSponsored = Boolean(pinnedPaidPostId && postId && postId === pinnedPaidPostId);
          emitSuggestedPlacesAnalytics({
            action: 'business_card_impression',
            businessKey: id,
            postId,
            position: Number.isFinite(idx) ? idx : undefined,
          });
          if (isSponsored && postId) {
            emitSuggestedPlacesAnalytics({
              action: 'business_card_sponsored_impression',
              businessKey: id,
              postId,
            });
          }
        }
      },
      { threshold: [0.6] }
    );
    Object.values(cardRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [visibleBusinessCards, pinnedPaidPostId]);

  const openCard = (card: BusinessCardModel) => {
    if (!card.canViewProfile) return;
    emitSuggestedPlacesAnalytics({
      action: 'business_card_profile_open',
      businessKey: card.id,
      postId: card.postId,
    });
    if (card.handle) navigate(`/user/${card.handle}`);
    else if (card.postId) jumpToPost(card.postId);
  };

  return (
    <section className="mb-2">
      <h3 className="mx-4 mb-2.5 text-[16px] font-bold leading-[21px] tracking-tight text-white">
        Local businesses you might like
      </h3>

      {visibleBusinessCards.length === 0 ? (
        <div className="mx-4 rounded-2xl border border-[#30363d] bg-[#0d1318] px-3 py-4 text-center">
          <p className="text-[12px] text-[#bdbdbd]">No business profiles available right now.</p>
        </div>
      ) : (
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-hide">
        {visibleBusinessCards.map((card, idx) => {
          const isSponsored = Boolean(pinnedPaidPostId && card.postId && card.postId === pinnedPaidPostId);
          const preview = card.post ? featuredPreviewFromPost(card.post) : null;
          const videoSrc =
            preview?.isVideo && preview.mediaUrl
              ? resolveMockFeedVideoUrl(preview.mediaUrl)
              : preview?.isVideo && preview.thumbnailUrl && VIDEO_SRC_RE.test(preview.thumbnailUrl)
                ? resolveMockFeedVideoUrl(preview.thumbnailUrl)
                : undefined;
          const stillRaw =
            preview?.thumbnailUrl && !VIDEO_SRC_RE.test(preview.thumbnailUrl) && !preview.thumbnailUrl.startsWith('#')
              ? preview.thumbnailUrl
              : undefined;
          const stillSrc = stillRaw ? rewriteMediaUrlForClient(stillRaw) || stillRaw : undefined;
          return (
            <article
              key={card.id}
              ref={(el) => {
                cardRefs.current[card.id] = el;
              }}
              data-business-card-id={card.id}
              data-business-card-index={idx}
              data-business-post-id={card.postId || ''}
              className="w-full min-w-full shrink-0 overflow-hidden rounded-xl border border-white/35 bg-white/[0.14]"
            >
              <div className="relative h-80 bg-[#1a1a1a]">
                <button
                  type="button"
                  onClick={() => openCard(card)}
                  disabled={!card.canViewProfile}
                  className="absolute inset-0 block h-full w-full disabled:cursor-not-allowed"
                >
                  {videoSrc ? (
                    <PreviewVideo src={videoSrc} poster={stillSrc} />
                  ) : stillSrc ? (
                    <img src={stillSrc} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-white/[0.08]">
                      <Avatar src={card.avatarSrc} name={card.name} size={72} hideBorder />
                    </span>
                  )}
                  {preview && (videoSrc || stillSrc) ? (
                    <span className="absolute bottom-14 left-2.5 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5">
                      <IoPlay className="h-2.5 w-2.5 text-white" aria-hidden />
                      <span className="text-[10px] font-semibold text-white">{formatViews(preview.views)}</span>
                    </span>
                  ) : null}
                </button>
                {!card.isOwn && card.handle && onHideBusiness ? (
                  <button
                    type="button"
                    onClick={() => {
                      const key = normalizeHandle(card.handle);
                      if (!key) return;
                      emitSuggestedPlacesAnalytics({
                        action: 'business_card_hide',
                        businessKey: key,
                        postId: card.postId,
                      });
                      setLocallyHiddenBusinesses((prev) => new Set([...prev, key]));
                      setLastHiddenBusiness(key);
                      onHideBusiness(key);
                    }}
                    className="absolute right-2 top-2 z-[3] flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white"
                    aria-label="Not interested"
                  >
                    <IoClose className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={card.isOwn || !card.canViewProfile}
                  onClick={() => openCard(card)}
                  className="absolute bottom-2.5 left-2.5 right-2.5 z-[2] flex h-10 items-center justify-between rounded-full bg-white pl-3.5 pr-2.5 text-sm font-semibold text-[#111111] shadow-[0_2px_4px_rgba(0,0,0,0.2)] disabled:bg-white/70"
                >
                  <span>{card.isOwn ? 'You' : 'View profile'}</span>
                  {card.isOwn ? null : <IoChevronForward className="h-[18px] w-[18px]" aria-hidden />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => openCard(card)}
                disabled={!card.canViewProfile}
                className="flex w-full items-center gap-2.5 px-3 py-3 text-left disabled:cursor-not-allowed"
              >
                <Avatar src={card.avatarSrc} name={card.name} size={40} hideBorder />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold text-white">{card.name}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-white/70">
                    {isSponsored ? 'Sponsored' : card.subtitle}
                  </span>
                </span>
              </button>
            </article>
          );
        })}
      </div>
      )}
      {lastHiddenBusiness && (
        <div className="mt-2 flex items-center justify-between rounded-xl border border-[#363636] bg-black/35 px-2.5 py-2 text-[11px]">
          <span className="text-[#bdbdbd] truncate pr-3">Business hidden</span>
          <button
            type="button"
            onClick={() => {
              const key = lastHiddenBusiness;
              setLocallyHiddenBusinesses((prev) => {
                const next = new Set(prev);
                next.delete(key);
                return next;
              });
              emitSuggestedPlacesAnalytics({
                action: 'business_card_undo_hide',
                businessKey: key,
              });
              if (onUnhideBusiness) onUnhideBusiness(key);
              setLastHiddenBusiness(null);
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

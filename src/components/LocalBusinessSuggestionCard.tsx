import React from 'react';
import { FiMapPin } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';
import type { Post } from '../types';
import { emitSuggestedPlacesAnalytics } from '../utils/suggestedPlaces';

type LocalBusinessSuggestionCardProps = {
  posts: Post[];
  userLocal?: string;
  useMockBusinesses?: boolean;
  pinnedPaidPostId?: string;
  viewerHandle?: string | null;
  onFollowPost?: (post: Post) => void | Promise<void>;
  onHideBusiness?: (businessKey: string) => void;
  onUnhideBusiness?: (businessKey: string) => void;
  onLikeBusiness?: (businessKey: string) => void;
};

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
  onFollowPost,
  onHideBusiness,
  onUnhideBusiness,
  onLikeBusiness,
}: LocalBusinessSuggestionCardProps) {
  const navigate = useNavigate();
  const [followBusyId, setFollowBusyId] = React.useState<string | null>(null);
  const [locallyHiddenBusinesses, setLocallyHiddenBusinesses] = React.useState<Set<string>>(new Set());
  const [lastHiddenBusiness, setLastHiddenBusiness] = React.useState<string | null>(null);
  const cardRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const seenImpressionsRef = React.useRef<Set<string>>(new Set());
  if (!posts.length) {
    return (
      <section className="mx-3 mb-4 rounded-3xl border border-[#363636] bg-[#121212] p-3 shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
        <h3 className="text-sm font-semibold text-white tracking-tight">Local business you might like</h3>
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
    if (useMockBusinesses) {
      return mockBusinesses.map((mock, idx) => {
        const source = posts[idx % posts.length];
        return {
          ...mock,
          avatarSrc: mockBusinessAvatar(mock.name),
          handle: undefined,
          postId: source ? String(source.id) : undefined,
          post: source,
          isFollowing: false,
          isOwn: false,
        };
      });
    }
    return posts.slice(0, 8).map((post) => {
      const own = normalizeHandle(post.userHandle) === normalizeHandle(viewerHandle);
      return {
      id: String(post.id),
      name: post.venue || post.landmark || post.userHandle,
      subtitle: post.locationLabel || userLocal || 'Local match',
      avatarSrc: getAvatarForHandle(post.userHandle),
      handle: post.userHandle,
      postId: String(post.id),
      post,
      isFollowing: post.isFollowing,
      isOwn: own,
    };
    });
  }, [useMockBusinesses, mockBusinesses, posts, userLocal, viewerHandle]);
  const visibleBusinessCards = React.useMemo(
    () =>
      businessCards.filter((card) => {
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

  return (
    <section className="mx-3 mb-4 rounded-3xl border border-[#363636] bg-[#121212] p-3 shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white tracking-tight">Local business you might like</h3>
          <p className="mt-1 text-[11px] text-[#8e8e8e]">Connect with businesses near {userLocal || 'you'}.</p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-[#8ab4ff]">Suggested</span>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
        {visibleBusinessCards.map((card, idx) => {
          const busy = followBusyId === card.id;
          const isSponsored = Boolean(pinnedPaidPostId && card.postId && card.postId === pinnedPaidPostId);
          return (
            <article
              key={card.id}
              ref={(el) => {
                cardRefs.current[card.id] = el;
              }}
              data-business-card-id={card.id}
              data-business-card-index={idx}
              data-business-post-id={card.postId || ''}
              className="shrink-0 w-[165px] rounded-2xl border border-[#30363d] bg-[#0d1318] p-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
            >
              <button
                type="button"
                onClick={() => {
                  emitSuggestedPlacesAnalytics({
                    action: 'business_card_profile_open',
                    businessKey: card.id,
                    postId: card.postId,
                  });
                  if (card.handle) {
                    navigate(`/user/${card.handle}`);
                  } else if (card.postId) {
                    jumpToPost(card.postId);
                  }
                }}
                className="w-full"
              >
                <div className="mb-2.5 flex justify-center">
                  <Avatar src={card.avatarSrc} name={card.name} size={94} className="!rounded-full ring-1 ring-white/10" />
                </div>
                <p className="truncate text-center text-[15px] font-semibold text-white leading-tight">{card.name}</p>
                <p className="mt-0.5 truncate text-center text-[12px] text-[#8e8e8e]">{card.subtitle}</p>
                {isSponsored && (
                  <span className="mt-1 inline-block rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/85">
                    Sponsored
                  </span>
                )}
              </button>
              <button
                type="button"
                disabled={busy || card.isOwn}
                onClick={async () => {
                  if (!card.post || !onFollowPost || card.isOwn) return;
                  emitSuggestedPlacesAnalytics({
                    action: 'business_card_follow_click',
                    businessKey: card.id,
                    postId: card.postId,
                  });
                  setFollowBusyId(card.id);
                  try {
                    await onFollowPost(card.post);
                  } finally {
                    setFollowBusyId((cur) => (cur === card.id ? null : cur));
                  }
                }}
                className={`mt-3 w-full rounded-xl py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  card.isFollowing
                    ? 'border border-[#3a3a3a] bg-transparent text-white hover:bg-white/5'
                    : 'bg-[#4f68ff] text-white hover:bg-[#6077ff]'
                }`}
              >
                {busy ? 'Saving…' : card.isOwn ? 'You' : card.isFollowing ? 'Following' : 'Follow'}
              </button>
              <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[#8e8e8e]">
                <FiMapPin className="h-3 w-3" />
                <span className="truncate">{userLocal || 'Local match'}</span>
              </div>
              {!card.isOwn && card.handle && onHideBusiness && (
                <div className="mt-1 flex items-center justify-between gap-2">
                  {onLikeBusiness && (
                    <button
                      type="button"
                      onClick={() => {
                        const key = normalizeHandle(card.handle);
                        if (!key) return;
                        emitSuggestedPlacesAnalytics({
                          action: 'business_card_more_like_this',
                          businessKey: key,
                          postId: card.postId,
                        });
                        onLikeBusiness(key);
                      }}
                      className="text-[10px] font-medium text-[#8ab4ff] hover:text-[#b7d0ff]"
                    >
                      More like this
                    </button>
                  )}
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
                    className="text-[10px] font-medium text-white/55 hover:text-white/85"
                  >
                    Not interested
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
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

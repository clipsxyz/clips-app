import type { Post, User } from '../types';
import {
  findPlaceMatchedPosts,
  suggestedPlacesBundleKey,
  type PlaceMatchedPost,
} from './suggestedPlaces';

export type FeedStreamRow =
  | { type: 'post'; item: Post; createdAt: number }
  | { type: 'ad'; item: import('../types').Ad; createdAt: number }
  | { type: 'local_business'; item: { posts: Post[]; pinnedPaidPostId?: string }; createdAt: number }
  | { type: 'suggested'; item: { suggestions: PlaceMatchedPost[] }; createdAt: number };

export const BUSINESS_SUGGESTION_CAP_MS = 12 * 60 * 60 * 1000;

function seededHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle<T>(arr: T[], seedInput: string): T[] {
  const next = [...arr];
  let seed = seededHash(seedInput) || 1;
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 10000) / 10000;
  };
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export type SuggestedPlacesPrefs = {
  dismissAll: boolean;
  dismissedBundles: string[];
  includePosterLocale: boolean;
};

export type BuildFlatWithSuggestedParams = {
  flat: FeedStreamRow[];
  user: User | null;
  userId: string;
  activeTab: string;
  customLocation: string | null;
  suggestedCardsV2Enabled: boolean;
  previewSuggestedCards: boolean;
  suggestedPlacesPrefs: SuggestedPlacesPrefs;
  serverPlaceSuggestions?: PlaceMatchedPost[];
  businessStripEligible: boolean;
  businessLastShown: Record<string, number>;
  hiddenBusinesses: Set<string>;
  likedBusinesses: Set<string>;
  /** Promoted businesses that share the viewer's local. Shown on local, regional, and national. */
  promotedLocalPosts?: Post[];
  homeFeedScope?: 'local' | 'regional' | 'national' | 'following' | null;
};

function normalizeBusinessHandle(value: string | null | undefined): string {
  return String(value || '').replace(/^@/, '').trim().toLowerCase();
}

function postMatchesViewerLocal(post: Post, localNorm: string): boolean {
  if (!localNorm) return false;
  const authorLocal = String(post.userLocal || '').trim().toLowerCase();
  if (authorLocal === localNorm) return true;
  const label = String(post.locationLabel || '').trim().toLowerCase();
  const venue = String(post.venue || '').trim().toLowerCase();
  const landmark = String(post.landmark || '').trim().toLowerCase();
  return label.includes(localNorm) || venue.includes(localNorm) || landmark.includes(localNorm);
}

/**
 * Business cards for people who share the viewer's local.
 * A promoted business leads the row on the local, regional, and national feeds.
 */
export function selectLocalBusinessStrip(input: {
  posts: Post[];
  promotedPosts?: Post[];
  user: User | null;
  seedBase: string;
  hiddenBusinesses: Set<string>;
  likedBusinesses: Set<string>;
  businessLastShown: Record<string, number>;
  homeFeedScope?: 'local' | 'regional' | 'national' | 'following' | null;
}): { posts: Post[]; pinnedPaidPostId?: string } {
  const scope = input.homeFeedScope;
  if (scope && scope !== 'local' && scope !== 'regional' && scope !== 'national') {
    return { posts: [] };
  }
  const localNorm = String(input.user?.local || '').trim().toLowerCase();
  const viewerHandle = normalizeBusinessHandle(input.user?.handle);
  if (!localNorm) return { posts: [] };

  const postTimeMs = (post: Post) => {
    if (typeof post.createdAt === 'number' && Number.isFinite(post.createdAt)) return post.createdAt;
    if (typeof post.created_at === 'string') {
      const parsed = Date.parse(post.created_at);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  };
  const rankScore = (post: Post): number => {
    const handleKey = normalizeBusinessHandle(post.userHandle);
    const inLocalScore = postMatchesViewerLocal(post, localNorm) ? 2 : 0;
    const businessSignalScore = post.isBoosted || post.boostFeedType ? 1.4 : post.venue || post.landmark ? 1.0 : 0.4;
    const followScore = post.isFollowing ? -1.5 : 0.8;
    const preferenceScore = input.likedBusinesses.has(handleKey) ? 1.8 : 0;
    const ageHours = Math.max(0, (Date.now() - postTimeMs(post)) / (1000 * 60 * 60));
    const freshness = ageHours <= 24 ? 1.4 : ageHours <= 72 ? 0.7 : 0.2;
    return inLocalScore + businessSignalScore + followScore + preferenceScore + freshness;
  };
  const eligible = (post: Post, trustedLocal: boolean) => {
    if (post.userAccountType !== 'business') return false;
    const handleKey = normalizeBusinessHandle(post.userHandle);
    if (!handleKey || handleKey === viewerHandle || input.hiddenBusinesses.has(handleKey)) return false;
    return trustedLocal || postMatchesViewerLocal(post, localNorm);
  };

  const byId = new Map<string, Post>();
  for (const post of input.promotedPosts || []) {
    if (!eligible(post, true)) continue;
    byId.set(String(post.id), post);
  }
  const promotedIds = new Set(byId.keys());
  for (const post of input.posts) {
    const id = String(post.id);
    if (byId.has(id) || !eligible(post, false)) continue;
    if (rankScore(post) < 1.6) continue;
    byId.set(id, post);
  }

  const promoted = [...byId.values()].filter((post) => promotedIds.has(String(post.id)));
  const organic = [...byId.values()].filter((post) => !promotedIds.has(String(post.id)));
  organic.sort((a, b) => rankScore(b) - rankScore(a));
  const rankedOrganic = organic.filter((post) => rankScore(post) >= 1.6);
  const shuffledOrganic = shuffle(rankedOrganic, `${input.seedBase}:business`);
  const topScore = rankedOrganic[0] ? rankScore(rankedOrganic[0]) : -Infinity;
  const organicCards = topScore >= 2.4 ? shuffledOrganic : [];
  const posts = [...promoted, ...organicCards.filter((post) => !promotedIds.has(String(post.id)))].slice(0, 8);
  const pinned = promoted.find((post) => {
    const key = `${input.user?.id || 'anon'}:${String(post.id)}`;
    const last = input.businessLastShown[key] || 0;
    return Date.now() - last >= BUSINESS_SUGGESTION_CAP_MS;
  });

  return {
    posts,
    pinnedPaidPostId: pinned ? String(pinned.id) : undefined,
  };
}

/** Insert suggested-place strips and local-business cards between feed posts (matches web). */
export function buildFlatWithSuggested(params: BuildFlatWithSuggestedParams): FeedStreamRow[] {
  const {
    flat,
    user,
    activeTab,
    customLocation,
    suggestedCardsV2Enabled,
    previewSuggestedCards,
    suggestedPlacesPrefs,
    serverPlaceSuggestions,
    businessStripEligible,
    businessLastShown,
    hiddenBusinesses,
    likedBusinesses,
    promotedLocalPosts,
    homeFeedScope,
  } = params;

  if (!suggestedCardsV2Enabled) return flat;
  if (customLocation) return flat;
  if (!user) return flat;

  const posts = flat
    .filter((x): x is { type: 'post'; item: Post; createdAt: number } => x.type === 'post')
    .map((x) => x.item);
  const suggestionPool = posts.length > 5 ? posts.slice(2) : posts;

  const todayKey = new Date().toISOString().slice(0, 10);
  const seedBase = `${user.id || 'anon'}:${activeTab}:${todayKey}`;

  const matchedRaw =
    serverPlaceSuggestions !== undefined
      ? serverPlaceSuggestions
      : findPlaceMatchedPosts(user, suggestionPool, {
          max: 9,
          excludeOwn: true,
          includePosterRegionalNational: suggestedPlacesPrefs.includePosterLocale,
        });
  const matched = shuffle(matchedRaw, `${seedBase}:places`);

  const businessStrip = selectLocalBusinessStrip({
    posts,
    promotedPosts: promotedLocalPosts,
    user,
    seedBase,
    hiddenBusinesses,
    likedBusinesses,
    businessLastShown,
    homeFeedScope,
  });
  const localBusinessCandidates = businessStrip.posts;
  const paidPinnedId = businessStrip.pinnedPaidPostId;

  const bundlesRaw: { suggestions: PlaceMatchedPost[] }[] = [];
  for (let i = 0; i < matched.length; i += 3) {
    bundlesRaw.push({ suggestions: matched.slice(i, i + 3) });
  }

  let bundles = bundlesRaw;
  // Ireland keeps its own places preview in the feed screen. Business cards still rank here.
  if (previewSuggestedCards || suggestedPlacesPrefs.dismissAll) {
    bundles = [];
  } else if (suggestedPlacesPrefs.dismissedBundles.length > 0) {
    const dismissed = new Set(suggestedPlacesPrefs.dismissedBundles);
    bundles = bundlesRaw.filter((b) => !dismissed.has(suggestedPlacesBundleKey(b.suggestions)));
  }

  const out: FeedStreamRow[] = [];
  let bundleIdx = 0;
  let postCount = 0;
  const shouldInsertSuggestedStrip = (count: number, bundleIndex: number) =>
    bundleIndex < bundles.length && count === 3 + bundleIndex * 5;

  for (const it of flat) {
    out.push(it);
    if (it.type === 'post') {
      postCount += 1;
      if (businessStripEligible && localBusinessCandidates.length > 0 && postCount === 2) {
        out.push({
          type: 'local_business',
          item: {
            posts: localBusinessCandidates.slice(0, 8),
            pinnedPaidPostId: paidPinnedId,
          },
          createdAt: 0,
        });
      }
      if (shouldInsertSuggestedStrip(postCount, bundleIdx)) {
        out.push({
          type: 'suggested',
          item: bundles[bundleIdx],
          createdAt: 0,
        });
        bundleIdx += 1;
      }
    }
  }
  if (businessStripEligible && localBusinessCandidates.length > 0 && !out.some((r) => r.type === 'local_business')) {
    out.unshift({
      type: 'local_business',
      item: {
        posts: localBusinessCandidates.slice(0, 8),
        pinnedPaidPostId: paidPinnedId,
      },
      createdAt: 0,
    });
  }
  return out;
}

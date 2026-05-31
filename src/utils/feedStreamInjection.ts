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
};

/** Insert suggested-place strips and local-business cards between feed posts (matches web). */
export function buildFlatWithSuggested(params: BuildFlatWithSuggestedParams): FeedStreamRow[] {
  const {
    flat,
    user,
    userId,
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
  } = params;

  if (!suggestedCardsV2Enabled) return flat;
  if (customLocation) return flat;
  if (!user) return flat;
  if (previewSuggestedCards) return flat;

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

  const hasBusinessSignal = (p: Post) => p.userAccountType === 'business';
  const localNorm = (user.local || '').trim().toLowerCase();
  const postTimeMs = (p: Post) => {
    if (typeof p.createdAt === 'number' && Number.isFinite(p.createdAt)) return p.createdAt;
    if (typeof p.created_at === 'string') {
      const parsed = Date.parse(p.created_at);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  };
  const businessRankScore = (p: Post): number => {
    const handleKey = String(p.userHandle || '').trim().toLowerCase();
    const inLocalScore =
      ((p.userLocal || '').trim().toLowerCase() === localNorm ? 2 : 0) +
      ((p.locationLabel || '').trim().toLowerCase().includes(localNorm) ? 1.2 : 0) +
      ((p.venue || '').trim().toLowerCase().includes(localNorm) ? 1 : 0) +
      ((p.landmark || '').trim().toLowerCase().includes(localNorm) ? 1 : 0);
    const businessSignalScore = p.boostFeedType === 'local' ? 1.4 : p.venue || p.landmark ? 1.0 : 0.4;
    const followScore = p.isFollowing ? -1.5 : 0.8;
    const preferenceScore = likedBusinesses.has(handleKey) ? 1.8 : 0;
    const ageHours = Math.max(0, (Date.now() - postTimeMs(p)) / (1000 * 60 * 60));
    const freshness = ageHours <= 24 ? 1.4 : ageHours <= 72 ? 0.7 : 0.2;
    return inLocalScore + businessSignalScore + followScore + preferenceScore + freshness;
  };

  const canShowBusinessNow = (businessKey: string) => {
    const last = businessLastShown[businessKey] || 0;
    return Date.now() - last >= BUSINESS_SUGGESTION_CAP_MS;
  };

  const localBusinessCandidatesRaw = suggestionPool.filter((p) => {
    if (!localNorm) return false;
    const handleKey = String(p.userHandle || '').trim().toLowerCase();
    if (handleKey && hiddenBusinesses.has(handleKey)) return false;
    const inLocal =
      (p.userLocal || '').trim().toLowerCase() === localNorm ||
      (p.locationLabel || '').trim().toLowerCase().includes(localNorm) ||
      (p.venue || '').trim().toLowerCase().includes(localNorm) ||
      (p.landmark || '').trim().toLowerCase().includes(localNorm);
    return inLocal && hasBusinessSignal(p);
  });

  const scoredBusinesses = [...localBusinessCandidatesRaw]
    .map((p) => ({ post: p, score: businessRankScore(p) }))
    .sort((a, b) => b.score - a.score);
  const rankedBusinesses = scoredBusinesses.filter((entry) => entry.score >= 1.6).map((entry) => entry.post);
  const shuffledBusinesses = shuffle(rankedBusinesses, `${seedBase}:business`);
  const isActiveLocalBoost = (p: Post) => {
    const boosted = p.boostFeedType === 'local' || p.isBoosted;
    const notExpired = !p.boostExpiresAt || p.boostExpiresAt > Date.now();
    return boosted && notExpired;
  };
  const paidPinned = shuffledBusinesses.find((p) => {
    if (!isActiveLocalBoost(p)) return false;
    const key = `${userId}:${String(p.id)}`;
    return canShowBusinessNow(key);
  });
  const topBusinessScore = scoredBusinesses[0]?.score ?? -Infinity;
  const passesHardFallback = topBusinessScore >= 2.4;
  const localBusinessCandidates = paidPinned
    ? [paidPinned, ...shuffledBusinesses.filter((p) => String(p.id) !== String(paidPinned.id))]
    : passesHardFallback
      ? shuffledBusinesses
      : [];

  const bundlesRaw: { suggestions: PlaceMatchedPost[] }[] = [];
  for (let i = 0; i < matched.length; i += 3) {
    bundlesRaw.push({ suggestions: matched.slice(i, i + 3) });
  }

  let bundles = bundlesRaw;
  if (suggestedPlacesPrefs.dismissAll) {
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
            pinnedPaidPostId: paidPinned ? String(paidPinned.id) : undefined,
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
        pinnedPaidPostId: paidPinned ? String(paidPinned.id) : undefined,
      },
      createdAt: 0,
    });
  }
  return out;
}

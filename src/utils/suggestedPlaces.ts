import type { Post, User } from '../types';

export type PlaceSuggestionReason = 'places_traveled' | 'home_area';

export type PlaceMatchedPost = {
  post: Post;
  /** Place string from the post (venue, landmark, or location) that triggered the match */
  matchedPlace: string;
  reason: PlaceSuggestionReason;
  confidence?: 'high' | 'medium';
};

/** Same rules as profile “places from bio” parsing (comma, and, dashes, etc.). */
export function parsePlacesFromBio(bio: string): string[] {
  if (!bio || typeof bio !== 'string') return [];
  const parts = bio
    .split(/[,;\n.]|\s+and\s+|\s*[-–—]\s*|:\s*/i)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
  if (parts.length === 0 && bio.trim().length >= 2) return [bio.trim()];
  return [...new Set(parts)];
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export type ViewerPlaceBuckets = {
  home: Set<string>;
  traveled: Set<string>;
};

type PlaceFeedbackSets = {
  liked: Set<string>;
  disliked: Set<string>;
};

/** Registration location (local / regional / national) vs places traveled + bio-derived places. */
export function collectViewerPlaceBuckets(user: User | null): ViewerPlaceBuckets {
  const home = new Set<string>();
  const traveled = new Set<string>();
  const add = (set: Set<string>, raw?: string) => {
    const n = norm(raw || '');
    if (n.length >= 2) set.add(n);
  };
  if (!user) return { home, traveled };
  add(home, user.local);
  add(home, user.regional);
  add(home, user.national);
  if (Array.isArray(user.placesTraveled)) {
    user.placesTraveled.forEach((p) => add(traveled, p));
  }
  for (const p of parsePlacesFromBio(user.bio || '')) {
    add(traveled, p);
  }
  return { home, traveled };
}

type WeightedPlace = { value: string; weight: number };

function postPlaceStrings(post: Post, includePosterRegionalNational?: boolean): WeightedPlace[] {
  const list: WeightedPlace[] = [];
  const push = (v: string | undefined, weight: number) => {
    const t = (v || '').trim();
    if (t.length >= 2) list.push({ value: t, weight });
  };
  // Prefer explicit metadata (carousel) over author locale — optional poster regional/national
  // can flood the feed (e.g. every “Ireland” post); off by default.
  push(post.venue, 4);
  push(post.landmark, 4);
  push(post.locationLabel, 2);
  push(post.userLocal, 1);
  if (includePosterRegionalNational) {
    push(post.userRegional, 1);
    push(post.userNational, 1);
  }
  return list;
}

/** Stable id for dismiss / analytics (sorted post ids in the strip). */
export function suggestedPlacesBundleKey(suggestions: PlaceMatchedPost[]): string {
  return suggestions.map((s) => String(s.post.id)).sort().join('|');
}

function signalMatchesField(signalNorm: string, fieldRaw: string): boolean {
  const f = norm(fieldRaw);
  if (!signalNorm || !f) return false;
  if (signalNorm === f) return true;
  if (signalNorm.length >= 3 && f.includes(signalNorm)) return true;
  if (f.length >= 3 && signalNorm.includes(f)) return true;
  const sw = signalNorm.split(/\s+/).filter((w) => w.length >= 3);
  const fw = f.split(/[\s,]+/).filter((w) => w.length >= 3);
  for (const a of sw) {
    if (fw.includes(a)) return true;
  }
  for (const a of fw) {
    if (sw.includes(a)) return true;
  }
  return false;
}

function findBestPlaceMatch(
  post: Post,
  buckets: ViewerPlaceBuckets,
  includePosterRegionalNational?: boolean
): { matchedPlace: string; reason: PlaceSuggestionReason } | null {
  if (buckets.home.size === 0 && buckets.traveled.size === 0) return null;
  const candidates = postPlaceStrings(post, includePosterRegionalNational).sort((a, b) => b.weight - a.weight);
  for (const { value } of candidates) {
    for (const sig of buckets.traveled) {
      if (signalMatchesField(sig, value)) {
        return { matchedPlace: value.trim(), reason: 'places_traveled' };
      }
    }
    for (const sig of buckets.home) {
      if (signalMatchesField(sig, value)) {
        return { matchedPlace: value.trim(), reason: 'home_area' };
      }
    }
  }
  return null;
}

function readPlaceFeedbackSets(): PlaceFeedbackSets {
  const liked = new Set<string>();
  const disliked = new Set<string>();
  try {
    const likedRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('clips:suggestedPlacesLikedPlaces') : null;
    const dislikedRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('clips:suggestedPlacesDislikedPlaces') : null;
    const likedList = likedRaw ? (JSON.parse(likedRaw) as string[]) : [];
    const dislikedList = dislikedRaw ? (JSON.parse(dislikedRaw) as string[]) : [];
    for (const p of likedList) {
      const n = norm(String(p || ''));
      if (n) liked.add(n);
    }
    for (const p of dislikedList) {
      const n = norm(String(p || ''));
      if (n) disliked.add(n);
    }
  } catch {
    /* ignore malformed data */
  }
  return { liked, disliked };
}

function placeAffinityScore(place: string, feedback: PlaceFeedbackSets): number {
  const p = norm(place);
  if (!p) return 0;
  let score = 0;
  for (const d of feedback.disliked) {
    if (signalMatchesField(d, p) || signalMatchesField(p, d)) score -= 6;
  }
  for (const l of feedback.liked) {
    if (signalMatchesField(l, p) || signalMatchesField(p, l)) score += 3;
  }
  return score;
}

function postTimestampMs(post: Post): number {
  if (typeof post.createdAt === 'number' && Number.isFinite(post.createdAt)) return post.createdAt;
  if (typeof post.created_at === 'string') {
    const parsed = Date.parse(post.created_at);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function freshnessScore(post: Post): number {
  const ts = postTimestampMs(post);
  if (!ts) return 0;
  const ageHours = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60));
  // Gentle decay: strong for recent posts, fades over ~3 days.
  if (ageHours <= 3) return 2.5;
  if (ageHours <= 12) return 2.0;
  if (ageHours <= 24) return 1.4;
  if (ageHours <= 48) return 0.9;
  if (ageHours <= 72) return 0.4;
  return 0;
}

/**
 * Pick posts in feed order whose venue / landmark / location overlaps the viewer’s
 * registration location or places traveled (including bio-derived places).
 */
export function findPlaceMatchedPosts(
  user: User | null,
  posts: Post[],
  options?: { max?: number; excludeOwn?: boolean; includePosterRegionalNational?: boolean }
): PlaceMatchedPost[] {
  const max = options?.max ?? 12;
  const excludeOwn = options?.excludeOwn !== false;
  const includePosterRegionalNational = options?.includePosterRegionalNational === true;
  const buckets = collectViewerPlaceBuckets(user);
  if (buckets.home.size === 0 && buckets.traveled.size === 0) return [];

  const handle = (user?.handle || '').trim().toLowerCase();
  const out: Array<{ item: PlaceMatchedPost; score: number; index: number }> = [];
  const seen = new Set<string>();
  const feedback = readPlaceFeedbackSets();

  for (let index = 0; index < posts.length; index++) {
    const post = posts[index];
    if (excludeOwn && handle && post.userHandle.trim().toLowerCase() === handle) continue;
    const hit = findBestPlaceMatch(post, buckets, includePosterRegionalNational);
    if (!hit) continue;
    const affinity = placeAffinityScore(hit.matchedPlace, feedback);
    // Strong negative feedback should suppress this suggestion.
    if (affinity <= -6) continue;
    const id = String(post.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const base = hit.reason === 'places_traveled' ? 2 : 1;
    const recent = freshnessScore(post);
    out.push({
      item: { post, matchedPlace: hit.matchedPlace, reason: hit.reason },
      score: base + affinity + recent,
      index,
    });
  }
  out.sort((a, b) => b.score - a.score || a.index - b.index);

  // Diversity guardrails: avoid over-concentration from the same place or author.
  const placeCap = 2;
  const authorCap = 2;
  const selected: PlaceMatchedPost[] = [];
  const placeCounts = new Map<string, number>();
  const authorCounts = new Map<string, number>();

  for (const entry of out) {
    if (selected.length >= max) break;
    const placeKey = norm(entry.item.matchedPlace);
    const authorKey = norm(entry.item.post.userHandle);
    const usedPlace = placeCounts.get(placeKey) ?? 0;
    const usedAuthor = authorCounts.get(authorKey) ?? 0;
    if (usedPlace >= placeCap || usedAuthor >= authorCap) continue;
    const withConfidence: PlaceMatchedPost = {
      ...entry.item,
      confidence: entry.score >= 4 ? 'high' : 'medium',
    };
    selected.push(withConfidence);
    placeCounts.set(placeKey, usedPlace + 1);
    authorCounts.set(authorKey, usedAuthor + 1);
  }

  return selected;
}

export function reasonLabel(reason: PlaceSuggestionReason): string {
  if (reason === 'places_traveled') return 'A place you’ve listed';
  return 'Your home area';
}

export function reasonExplanation(
  reason: PlaceSuggestionReason,
  matchedPlace: string,
  confidence: PlaceMatchedPost['confidence'] = 'medium'
): string {
  if (reason === 'places_traveled') {
    return confidence === 'high'
      ? `Suggested because you strongly engage with ${matchedPlace}`
      : `Suggested because you selected ${matchedPlace}`;
  }
  return confidence === 'high'
    ? `Suggested because your local area closely matches ${matchedPlace}`
    : `Suggested because it matches your home area: ${matchedPlace}`;
}

export type SuggestedPlacesAnalyticsDetail =
  | { action: 'strip_view'; bundleKey: string; suggestionCount: number; includePosterRegionalNational: boolean }
  | {
      action: 'jump_to_post';
      postId: string;
      matchedPlace: string;
      reason: PlaceSuggestionReason;
      bundleKey: string;
    }
  | { action: 'dismiss_row'; bundleKey: string }
  | { action: 'dismiss_all' }
  | { action: 'toggle_poster_locale'; enabled: boolean }
  | { action: 'not_interested_post'; postId: string; matchedPlace: string; reason: PlaceSuggestionReason; bundleKey: string }
  | { action: 'more_like_this'; postId: string; matchedPlace: string; reason: PlaceSuggestionReason; bundleKey: string }
  | { action: 'business_card_impression'; businessKey: string; postId?: string; position?: number }
  | { action: 'business_card_profile_open'; businessKey: string; postId?: string }
  | { action: 'business_card_follow_click'; businessKey: string; postId?: string }
  | { action: 'business_card_hide'; businessKey: string; postId?: string }
  | { action: 'business_card_undo_hide'; businessKey: string; postId?: string }
  | { action: 'business_card_more_like_this'; businessKey: string; postId?: string }
  | { action: 'business_card_sponsored_impression'; businessKey: string; postId: string };

/** Hook analytics / product tools: `window.addEventListener('suggestedPlacesAnalytics', …)`. */
export function emitSuggestedPlacesAnalytics(detail: SuggestedPlacesAnalyticsDetail): void {
  try {
    window.dispatchEvent(new CustomEvent('suggestedPlacesAnalytics', { detail }));
  } catch {
    /* ignore */
  }
}

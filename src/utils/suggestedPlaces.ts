import type { Post, User } from '../types';

export type PlaceSuggestionReason = 'places_traveled' | 'home_area';

export type PlaceMatchedPost = {
  post: Post;
  /** Place string from the post (venue, landmark, or location) that triggered the match */
  matchedPlace: string;
  reason: PlaceSuggestionReason;
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
  const out: PlaceMatchedPost[] = [];
  const seen = new Set<string>();

  for (const post of posts) {
    if (excludeOwn && handle && post.userHandle.trim().toLowerCase() === handle) continue;
    const hit = findBestPlaceMatch(post, buckets, includePosterRegionalNational);
    if (!hit) continue;
    const id = String(post.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ post, matchedPlace: hit.matchedPlace, reason: hit.reason });
    if (out.length >= max) break;
  }
  return out;
}

export function reasonLabel(reason: PlaceSuggestionReason): string {
  if (reason === 'places_traveled') return 'A place you’ve listed';
  return 'Your home area';
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
  | { action: 'toggle_poster_locale'; enabled: boolean };

/** Hook analytics / product tools: `window.addEventListener('suggestedPlacesAnalytics', …)`. */
export function emitSuggestedPlacesAnalytics(detail: SuggestedPlacesAnalyticsDetail): void {
  try {
    window.dispatchEvent(new CustomEvent('suggestedPlacesAnalytics', { detail }));
  } catch {
    /* ignore */
  }
}

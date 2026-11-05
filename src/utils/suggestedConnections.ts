import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAvatarForHandle } from '../api/users';
import { hasPendingFollowRequest, isProfilePrivate } from '../api/privacy';
import { MOCK_FOLLOWING_GRAPH } from '../api/mockFollowGraph';

export type SuggestedPersonSource = {
    handleNoAt: string;
    displayName?: string;
    avatarUrl?: string;
    isPrivate?: boolean;
    isRequested?: boolean;
};

export type SuggestedPerson = {
    handleNoAt: string;
    displayName: string;
    avatarUrl?: string;
    suggestionReason: string;
    mutualCount: number;
    isPrivate?: boolean;
    isRequested?: boolean;
};

type PostSignal = {
    id?: string;
    userHandle?: string;
    createdAt?: number;
    avatarUrl?: string;
};

function normalizeHandle(value: string): string {
    return String(value || '').replace(/^@/, '').trim().toLowerCase();
}

function isSeedPostId(id: string): boolean {
    return (
        id.startsWith('post-') ||
        id.startsWith('artane-post-') ||
        id.startsWith('bob-post-') ||
        id.startsWith('ava-boosted-demo-') ||
        id.startsWith('ava-normal-') ||
        id.startsWith('mock-scenes-')
    );
}

function clusterOf(handle: string): string {
    const normalized = normalizeHandle(handle);
    return normalized.split('@')[1] || normalized;
}

function storageKey(viewerId: string): string {
    return `clips_suggested_dismissed_${viewerId}`;
}

export async function loadDismissedSuggestions(viewerId: string): Promise<Record<string, boolean>> {
    if (!viewerId) return {};
    try {
        const raw = await AsyncStorage.getItem(storageKey(viewerId));
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export async function saveDismissedSuggestions(
    viewerId: string,
    map: Record<string, boolean>,
): Promise<void> {
    if (!viewerId) return;
    try {
        await AsyncStorage.setItem(storageKey(viewerId), JSON.stringify(map));
    } catch {
        // A failed write still hides the row for this session.
    }
}

/**
 * People the viewer does not already follow, ranked like the web profile sheet:
 * shared connection with the open profile, then fresher clips, then clip count.
 * One place (the part after @) cannot fill the top of the list.
 */
export function buildSuggestedConnections(opts: {
    followers: SuggestedPersonSource[];
    following: SuggestedPersonSource[];
    posts?: PostSignal[];
    viewerHandle?: string;
    profileHandle?: string;
    alreadyFollowing?: Iterable<string>;
    dismissed?: Record<string, boolean>;
    /** Mock handles and seed-post authors. Leave off when the live API is on. */
    includeMockAuthors?: boolean;
}): SuggestedPerson[] {
    const viewerKey = normalizeHandle(opts.viewerHandle || '');
    const profileKey = normalizeHandle(opts.profileHandle || '');
    const profileLabel = profileKey ? `@${String(opts.profileHandle || '').replace(/^@/, '')}` : 'this profile';
    const followed = new Set(
        Array.from(opts.alreadyFollowing || []).map((entry) => normalizeHandle(String(entry))),
    );
    const excluded = new Set<string>([viewerKey, profileKey, ...followed].filter(Boolean));
    Object.entries(opts.dismissed || {}).forEach(([key, hidden]) => {
        if (hidden) excluded.add(normalizeHandle(key));
    });

    const followerMap = new Map(opts.followers.map((row) => [normalizeHandle(row.handleNoAt), row]));
    const followingMap = new Map(opts.following.map((row) => [normalizeHandle(row.handleNoAt), row]));
    const postCount = new Map<string, number>();
    const recency = new Map<string, number>();
    const postAvatars = new Map<string, string>();
    const now = Date.now();

    (opts.posts || []).forEach((post) => {
        const id = String(post.id || '');
        if (!opts.includeMockAuthors && id && isSeedPostId(id)) return;
        const key = normalizeHandle(post.userHandle || '');
        if (!key) return;
        postCount.set(key, (postCount.get(key) || 0) + 1);
        const created = Number(post.createdAt || 0);
        const createdMs = created > 0 && created < 1e12 ? created * 1000 : created;
        const ageHours = createdMs > 0 ? Math.max(0, (now - createdMs) / 3600000) : 168;
        const weight = Math.max(0.2, 1 - ageHours / 168);
        recency.set(key, (recency.get(key) || 0) + weight);
        if (post.avatarUrl && !postAvatars.has(key)) postAvatars.set(key, post.avatarUrl);
    });

    const suggested = new Map<string, SuggestedPerson & { score: number; cluster: string }>();
    const add = (rawHandle: string, rawName?: string) => {
        const handleNoAt = String(rawHandle || '').replace(/^@/, '').trim();
        const key = normalizeHandle(handleNoAt);
        if (!key || excluded.has(key) || suggested.has(key)) return;
        const follower = followerMap.get(key);
        const following = followingMap.get(key);
        const mutualCount = (follower ? 1 : 0) + (following ? 1 : 0);
        const clips = postCount.get(key) || 0;
        const suggestionReason =
            mutualCount === 2
                ? `Mutual connection with ${profileLabel}`
                : following
                  ? `Followed by ${profileLabel}`
                  : follower
                    ? `Follows ${profileLabel}`
                    : clips > 1
                      ? `${clips} recent clips`
                      : 'Suggested for you';
        const score = mutualCount * 100 + (recency.get(key) || 0) * 18 + clips * 2;
        suggested.set(key, {
            handleNoAt,
            displayName: rawName || follower?.displayName || following?.displayName || handleNoAt,
            avatarUrl:
                follower?.avatarUrl ||
                following?.avatarUrl ||
                postAvatars.get(key) ||
                getAvatarForHandle(handleNoAt),
            suggestionReason,
            mutualCount,
            isPrivate: follower?.isPrivate || following?.isPrivate || isProfilePrivate(handleNoAt),
            isRequested:
                follower?.isRequested ||
                following?.isRequested ||
                !!(opts.viewerHandle && hasPendingFollowRequest(opts.viewerHandle, handleNoAt)),
            score,
            cluster: clusterOf(handleNoAt),
        });
    };

    [...opts.followers, ...opts.following].forEach((row) => add(row.handleNoAt, row.displayName));
    (opts.posts || []).forEach((post) => {
        const id = String(post.id || '');
        if (!opts.includeMockAuthors && id && isSeedPostId(id)) return;
        if (post.userHandle) add(post.userHandle, post.userHandle);
    });
    if (opts.includeMockAuthors) {
        Object.keys(MOCK_FOLLOWING_GRAPH).forEach((handle) => add(handle, handle));
    }

    const ranked = Array.from(suggested.values()).sort((a, b) => b.score - a.score);
    const clusterCount = new Map<string, number>();
    const balanced: SuggestedPerson[] = [];
    ranked.forEach((person) => {
        const used = clusterCount.get(person.cluster) || 0;
        if (used >= 3 && balanced.length < 50) return;
        balanced.push({
            handleNoAt: person.handleNoAt,
            displayName: person.displayName,
            avatarUrl: person.avatarUrl,
            suggestionReason: person.suggestionReason,
            mutualCount: person.mutualCount,
            isPrivate: person.isPrivate,
            isRequested: person.isRequested,
        });
        clusterCount.set(person.cluster, used + 1);
    });
    return balanced.slice(0, 80);
}

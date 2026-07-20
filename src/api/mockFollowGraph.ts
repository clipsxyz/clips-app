/**
 * Mock follow edges for local testing when Laravel lists / check-follows-me are unavailable.
 * Keys and list entries are matched case-insensitively.
 */
export const MOCK_FOLLOWING_GRAPH: Record<string, string[]> = {
    'ava@galway': ['bob@ireland'],
    'bob@ireland': ['ava@galway', 'barry@dublin'],
};

export function normalizeHandleForMockGraph(value: string): string {
    return value.replace(/^@/, '').trim().toLowerCase();
}

/** Header follower/following counts that match mock connection lists. */
export function computeMockGraphFollowCounts(
    decodedHandle: string,
    viewerHandle: string | undefined,
    viewerFollows: string[],
): { followers: number; following: number } {
    const normalizedTarget = normalizeHandleForMockGraph(decodedHandle);
    const viewerFollowedSet = new Set(viewerFollows.map((h) => normalizeHandleForMockGraph(h)));
    const followersSet = new Set<string>();
    Object.entries(MOCK_FOLLOWING_GRAPH).forEach(([followerHandle, followingList]) => {
        const followsTarget = (followingList || []).some(
            (entry) => normalizeHandleForMockGraph(entry) === normalizedTarget,
        );
        if (followsTarget) followersSet.add(normalizeHandleForMockGraph(followerHandle));
    });
    if (viewerHandle && viewerFollowedSet.has(normalizedTarget)) {
        followersSet.add(normalizeHandleForMockGraph(viewerHandle));
    }
    const followingSet = new Set<string>(
        (MOCK_FOLLOWING_GRAPH[normalizedTarget] || []).map((entry) =>
            normalizeHandleForMockGraph(entry),
        ),
    );
    if (viewerHandle && normalizeHandleForMockGraph(viewerHandle) === normalizedTarget) {
        viewerFollows.forEach((entry) => followingSet.add(normalizeHandleForMockGraph(String(entry))));
    }
    return { followers: followersSet.size, following: followingSet.size };
}

/** True if mock data says `authorHandle` follows `viewerHandle` (for mutual-follow / DM). */
export function mockAuthorFollowsViewer(authorHandle: string, viewerHandle: string): boolean {
    if (!authorHandle || !viewerHandle) return false;
    const na = normalizeHandleForMockGraph(authorHandle);
    const nv = normalizeHandleForMockGraph(viewerHandle);
    const entry = Object.entries(MOCK_FOLLOWING_GRAPH).find(([k]) => normalizeHandleForMockGraph(k) === na);
    const list = entry ? entry[1] : [];
    return list.some((h) => normalizeHandleForMockGraph(h) === nv);
}

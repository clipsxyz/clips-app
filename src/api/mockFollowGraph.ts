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

/** True if mock data says `authorHandle` follows `viewerHandle` (for mutual-follow / DM). */
export function mockAuthorFollowsViewer(authorHandle: string, viewerHandle: string): boolean {
    if (!authorHandle || !viewerHandle) return false;
    const na = normalizeHandleForMockGraph(authorHandle);
    const nv = normalizeHandleForMockGraph(viewerHandle);
    const entry = Object.entries(MOCK_FOLLOWING_GRAPH).find(([k]) => normalizeHandleForMockGraph(k) === na);
    const list = entry ? entry[1] : [];
    return list.some((h) => normalizeHandleForMockGraph(h) === nv);
}

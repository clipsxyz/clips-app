export type SharedPostRef = { postId?: string; token?: string };

/** Match public share links (`https://host/p/<token>`) emitted by buildShareablePostUrl. */
const sharedTokenPattern = /https?:\/\/[^\s/]+\/p\/([A-Za-z0-9_-]{4,})(?:\/|\?|#|$|\s)/i;

/** Stable cache key for a resolved shared post reference. */
export function sharedPostRefKey(ref: SharedPostRef): string {
    return ref.token ? `token:${ref.token}` : `post:${ref.postId ?? ''}`;
}

/**
 * Resolve a shareable post reference from DM text. Prefers `/p/<token>`
 * public links, then falls back to any recognizable post id.
 */
export function extractSharedPostRef(text: string): SharedPostRef | null {
    if (!text) return null;

    const tokenMatch = text.match(sharedTokenPattern);
    if (tokenMatch?.[1]) return { token: tokenMatch[1] };

    const postId = extractPostId(text);
    if (postId) return { postId };

    return null;
}

/** Extract a post id from DM text (URL, path, or known id formats). */
export function extractPostId(text: string): string | null {
    if (!text) return null;

    const fullUrlPattern = /https?:\/\/[^\s/]+\/post\/([^\s/?&#]+?)(?:\/|\?|#|$)/i;
    let match = text.match(fullUrlPattern);
    if (match?.[1]) return match[1];

    const pathPattern = /\/?post\/([^\s/?&#]+?)(?:\/|\?|#|$|\s)/i;
    match = text.match(pathPattern);
    if (match?.[1]) return match[1];

    const uuidTimestampPattern =
        /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-\d+)/i;
    match = text.match(uuidTimestampPattern);
    if (match?.[1]) return match[1];

    const oldFormatPattern = /(post-\d+-\d+-\d+-[a-z0-9]+)/i;
    match = text.match(oldFormatPattern);
    if (match?.[1]) return match[1];

    const artaneFormatPattern = /(artane-post-\d+-\d+-[a-z0-9]+)/i;
    match = text.match(artaneFormatPattern);
    if (match?.[1]) return match[1];

    const reclipFormatPattern = /(reclip-[^-]+-[^-]+-\d+)/i;
    match = text.match(reclipFormatPattern);
    if (match?.[1]) return match[1];

    const uuidPattern =
        /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?![-\d])/i;
    match = text.match(uuidPattern);
    if (match?.[1]) return match[1];

    return null;
}

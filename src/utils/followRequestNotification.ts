/** How a follow-request row names the person who asked to follow. */

export type FollowRequestIdentity = {
    title: string;
    handle: string;
    showHandle: boolean;
    isPrivate: boolean;
};

export function followRequestIdentity(item: {
    fromHandle?: string | null;
    fromDisplayName?: string | null;
    fromIsPrivate?: boolean | null;
}): FollowRequestIdentity {
    const handle = String(item.fromHandle || '').trim();
    const name = String(item.fromDisplayName || '').trim();
    const title = name || handle || 'Someone';

    return {
        title,
        handle,
        showHandle: Boolean(handle) && title.toLowerCase() !== handle.toLowerCase(),
        isPrivate: item.fromIsPrivate === true,
    };
}

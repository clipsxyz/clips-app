/** How a group-invite notification names the inviter and the group. */

export type GroupInvitePresentation = {
    title: string;
    handle: string;
    showHandle: boolean;
    groupName: string;
};

export function groupInvitePresentation(item: {
    fromHandle?: string | null;
    fromDisplayName?: string | null;
    groupName?: string | null;
    message?: string | null;
}): GroupInvitePresentation {
    const handle = String(item.fromHandle || '').trim();
    const name = String(item.fromDisplayName || '').trim();
    const title = name || handle || 'Someone';
    let groupName = String(item.groupName || '').trim();
    if (!groupName) {
        const message = String(item.message || '');
        const marker = 'invited you to join ';
        const index = message.toLowerCase().indexOf(marker);
        if (index >= 0) {
            groupName = message.slice(index + marker.length).trim();
        }
    }

    return {
        title,
        handle,
        showHandle: Boolean(handle) && title.toLowerCase() !== handle.toLowerCase(),
        groupName: groupName || 'a group',
    };
}

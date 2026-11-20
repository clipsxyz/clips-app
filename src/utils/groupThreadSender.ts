/** WhatsApp-style label for who sent a group message. */

const GROUP_SENDER_COLORS = [
    '#53BDEB',
    '#E542A3',
    '#7F66FF',
    '#FF7A45',
    '#1DAA61',
    '#F7B731',
    '#00A884',
    '#FF5C8A',
    '#8E6CFF',
    '#25D366',
];

export function groupSenderColor(handle?: string | null): string {
    const key = String(handle || '').trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
        hash = (hash * 31 + key.charCodeAt(i)) | 0;
    }
    return GROUP_SENDER_COLORS[Math.abs(hash) % GROUP_SENDER_COLORS.length];
}

export function groupSenderLabel(handle?: string | null): string {
    const raw = String(handle || '').trim();
    return raw || 'Member';
}

type RunNeighbor = {
    senderHandle?: string | null;
    isFromMe?: boolean;
    isSystem?: boolean;
};

/** Name is shown on the first incoming message of a consecutive run from that person. */
export function isGroupSenderRunStart(input: {
    isGroup: boolean;
    isFromMe: boolean;
    isSystem?: boolean;
    senderHandle?: string | null;
    previous?: RunNeighbor | null;
}): boolean {
    if (!input.isGroup || input.isFromMe || input.isSystem) return false;
    const previous = input.previous;
    if (!previous || previous.isSystem || previous.isFromMe) return true;
    return (
        String(previous.senderHandle || '').trim().toLowerCase() !==
        String(input.senderHandle || '').trim().toLowerCase()
    );
}

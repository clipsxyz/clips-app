const PROFILE_SHARE_TEXT = /^Check out @(.+?)'s profile!$/i;

/** Handle from a profile shared into Stories 24. Null for every other story. */
export function profileShareHandleFromText(text?: string | null): string | null {
    const match = String(text || '').trim().match(PROFILE_SHARE_TEXT);
    if (!match) return null;
    const handle = match[1].replace(/^@/, '').trim();
    return handle || null;
}

export function profileShareDisplayName(handle: string): string {
    const bare = handle.replace(/^@/, '').trim();
    const name = bare.split('@')[0]?.trim();
    return name || bare || 'Profile';
}

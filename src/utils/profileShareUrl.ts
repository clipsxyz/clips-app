/** Public profile URL for share sheets (web + native). */
export function buildProfileShareUrl(handle: string): string {
    const bare = decodeURIComponent(String(handle || '').replace(/^@/, '').trim());
    return `https://gazetteer.app/user/${encodeURIComponent(bare)}`;
}

export function formatProfileDisplayHandle(handle: string): string {
    const bare = String(handle || '').replace(/^@/, '').trim();
    return bare ? `@${bare}` : '';
}

export function getProfileShareMessage(name: string): string {
    const who = String(name || '').trim() || 'this profile';
    return `Check out ${who}'s profile on Gazetteer`;
}

/** WhatsApp-style per-sender name colors (stable hash of handle). */
export const DM_SENDER_NAME_COLORS = [
    '#53BDEB',
    '#FF8A80',
    '#CE93D8',
    '#80CBC4',
    '#AED581',
    '#FFD54F',
    '#81D4FA',
    '#F48FB1',
    '#9FA8DA',
    '#FFAB91',
    '#A5D6A7',
    '#FFF176',
] as const;

export function dmSenderNameColor(handle?: string | null): string {
    const s = String(handle || '').trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < s.length; i += 1) {
        hash = (Math.imul(31, hash) + s.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % DM_SENDER_NAME_COLORS.length;
    return DM_SENDER_NAME_COLORS[idx];
}

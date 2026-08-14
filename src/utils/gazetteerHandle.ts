/** Gazetteer handles look like `Name@Place` (alphanumeric only on each side). */

export function normalizeHandle(handle: string): string {
    return String(handle || '')
        .replace(/^@/, '')
        .trim()
        .toLowerCase();
}

/** Collapse spaces so "Super valu" → "Supervalu" (not first-word-only). */
export function sanitizeHandleNamePart(name: string): string {
    const collapsed = String(name || '')
        .trim()
        .replace(/\s+/g, '');
    const alnum = collapsed.replace(/[^a-zA-Z0-9]/g, '');
    return alnum || 'user';
}

export function sanitizeHandlePlacePart(place: string): string {
    const alnum = String(place || '')
        .trim()
        .replace(/[^a-zA-Z0-9]/g, '');
    return alnum || 'Unknown';
}

export function regionalFromHandle(handle: string): string {
    const raw = String(handle || '').replace(/^@/, '').trim();
    const at = raw.indexOf('@');
    if (at < 0) return '';
    return raw.slice(at + 1).trim();
}

export function buildGazetteerHandle(displayName: string, place: string): string {
    return `${sanitizeHandleNamePart(displayName)}@${sanitizeHandlePlacePart(place)}`;
}

/**
 * Next handle after a passport name edit.
 * Keeps the existing @place when possible; falls back to regional / local.
 */
export function nextHandleAfterNameChange(opts: {
    displayName: string;
    currentHandle?: string | null;
    regional?: string | null;
    local?: string | null;
}): string {
    const place =
        regionalFromHandle(opts.currentHandle || '') ||
        String(opts.regional || '').trim() ||
        String(opts.local || '').trim() ||
        'Unknown';
    return buildGazetteerHandle(opts.displayName, place);
}

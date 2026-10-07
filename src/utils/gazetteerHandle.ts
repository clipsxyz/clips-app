/**
 * Gazetteer handles are `Name@Place`.
 * The part before @ is the person's name (can be a city/country word, e.g. Paris, Ireland).
 * The part after @ is the only location.
 */

export function normalizeHandle(handle: string): string {
    return String(handle || '')
        .replace(/^@/, '')
        .trim()
        .toLowerCase();
}

function rawHandleWithoutLeadingAt(handle: string): string {
    return String(handle || '').replace(/^@/, '').trim();
}

/** Display name — never treat this as a place. */
export function nameFromHandle(handle: string): string {
    const raw = rawHandleWithoutLeadingAt(handle);
    const at = raw.indexOf('@');
    if (at < 0) return raw;
    return raw.slice(0, at).trim();
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

/** Location after @ — ignore the name even if the name is a city or country. */
export function regionalFromHandle(handle: string): string {
    const raw = rawHandleWithoutLeadingAt(handle);
    const at = raw.indexOf('@');
    if (at < 0) return '';
    return raw.slice(at + 1).trim();
}

export function buildGazetteerHandle(displayName: string, place: string): string {
    return `${sanitizeHandleNamePart(displayName)}@${sanitizeHandlePlacePart(place)}`;
}

/** Signup username: one word, letters/numbers/underscore (matches Laravel auth regex). */
export const SIGNUP_USERNAME_MIN = 3;
export const SIGNUP_USERNAME_MAX = 50;

export function sanitizeSignupUsernameInput(raw: string): string {
    return String(raw || '')
        .replace(/\s+/g, '')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, SIGNUP_USERNAME_MAX);
}

export function validateSignupUsername(raw: string): string | null {
    const value = sanitizeSignupUsernameInput(raw);
    if (!value) return 'Username is required.';
    if (value.length < SIGNUP_USERNAME_MIN) {
        return `Username must be at least ${SIGNUP_USERNAME_MIN} characters.`;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
        return 'Username must be one word (letters, numbers, underscore only).';
    }
    return null;
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

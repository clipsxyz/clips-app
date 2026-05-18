import type { LocationSuggestion } from '../api/locations';

export type FeedScope = 'local' | 'regional' | 'national';

export type PlaceFeedOption = {
    scope: FeedScope;
    label: string;
    filter: string;
};

export type ParsedPlaceFeed = {
    fullName: string;
    displayName: string;
    local: string;
    regional: string;
    national: string;
    defaultScope: FeedScope;
    options: PlaceFeedOption[];
};

function cleanPart(value: string | undefined | null): string {
    return String(value || '').trim();
}

function uniqueOptions(options: PlaceFeedOption[]): PlaceFeedOption[] {
    const seen = new Set<string>();
    return options.filter((opt) => {
        const key = `${opt.scope}:${opt.filter.toLowerCase()}`;
        if (!opt.filter || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function norm(value: string): string {
    return value.trim().toLowerCase();
}

/** User-facing picker label — matches home feed tiers but plain language. */
function pickerLabel(scope: FeedScope, placeName: string, partsCount: number): string {
    if (scope === 'national') return `Country · ${placeName}`;
    if (scope === 'regional') {
        return partsCount >= 3 ? `Region · ${placeName}` : `City · ${placeName}`;
    }
    return partsCount >= 3 ? `City · ${placeName}` : `Local area · ${placeName}`;
}

/** Build local / regional / national feed targets from a Places suggestion. */
export function parsedPlaceFeedFromSuggestion(s: LocationSuggestion): ParsedPlaceFeed {
    const fullName = cleanPart(s.name);
    const national = cleanPart(s.national) || cleanPart(s.country);
    const local = cleanPart(s.local);
    const regional = cleanPart(s.regional);

    const parts = fullName.split(',').map((p) => p.trim()).filter(Boolean);
    const parsedLocal = local || parts[0] || fullName;
    const parsedNational = national || parts[parts.length - 1] || parsedLocal;

    // Regional = city / metro (e.g. Dublin). For "Paris, France" use Paris — not France.
    let parsedRegional = regional;
    if (!parsedRegional || (parts.length === 2 && norm(parsedRegional) === norm(parsedNational))) {
        if (parts.length >= 3) {
            parsedRegional = parts[parts.length - 2];
        } else if (parts.length === 2) {
            parsedRegional = parts[0];
        } else {
            parsedRegional = parsedLocal;
        }
    }

    let defaultScope: FeedScope = 'local';
    if (parts.length <= 1 && parsedNational) {
        defaultScope = 'national';
    } else if (parts.length === 2) {
        defaultScope = 'regional';
    }

    const partsCount = parts.length;
    const rawOptions: PlaceFeedOption[] = [
        { scope: 'national', label: pickerLabel('national', parsedNational, partsCount), filter: parsedNational },
    ];
    if (norm(parsedRegional) !== norm(parsedNational)) {
        rawOptions.push({
            scope: 'regional',
            label: pickerLabel('regional', parsedRegional, partsCount),
            filter: parsedRegional,
        });
    }
    if (
        norm(parsedLocal) !== norm(parsedRegional) &&
        norm(parsedLocal) !== norm(parsedNational)
    ) {
        rawOptions.push({
            scope: 'local',
            label: pickerLabel('local', parsedLocal, partsCount),
            filter: parsedLocal,
        });
    }

    const options = uniqueOptions(rawOptions);

    const defaultOption =
        options.find((o) => o.scope === defaultScope) || options[0] || {
            scope: 'local' as const,
            label: pickerLabel('local', parsedLocal, partsCount),
            filter: parsedLocal,
        };

    return {
        fullName,
        displayName: defaultOption.filter,
        local: parsedLocal,
        regional: parsedRegional,
        national: parsedNational,
        defaultScope: defaultOption.scope,
        options: options.length > 0 ? options : [defaultOption],
    };
}

export function feedFilterForScope(parsed: ParsedPlaceFeed, scope: FeedScope): string {
    const match = parsed.options.find((o) => o.scope === scope);
    return match?.filter || parsed.displayName;
}

export function scopeLabel(scope: FeedScope): string {
    if (scope === 'national') return 'National';
    if (scope === 'regional') return 'Regional';
    return 'Local';
}

/** Plain-language summary for signup autocomplete (country / city / neighbourhood). */
export function formatFeedLevelsLine(s: LocationSuggestion): string {
    const parsed = parsedPlaceFeedFromSuggestion(s);
    const lines: string[] = [];

    if (parsed.national) {
        lines.push(`Country: ${parsed.national}`);
    }
    if (norm(parsed.regional) !== norm(parsed.national)) {
        lines.push(`City: ${parsed.regional}`);
    }
    if (
        norm(parsed.local) !== norm(parsed.regional) &&
        norm(parsed.local) !== norm(parsed.national)
    ) {
        lines.push(`Local area: ${parsed.local}`);
    }

    return lines.join(' · ');
}

export type SignupFeedTierDisplay = { label: string; value: string };

/** Rows for signup “home area saved” confirmation (no duplicate city/local). */
export function signupFeedTierRows(local: string, regional: string, national: string): SignupFeedTierDisplay[] {
    const rows: SignupFeedTierDisplay[] = [];
    const n = norm(national);
    const r = norm(regional);
    const l = norm(local);

    if (national.trim()) {
        rows.push({ label: 'Country', value: national.trim() });
    }
    if (regional.trim() && r !== n) {
        rows.push({ label: 'City', value: regional.trim() });
    }
    if (local.trim() && l !== r && l !== n) {
        rows.push({ label: 'Local area', value: local.trim() });
    }

    return rows;
}

const VENUE_SUFFIX_RE =
    /\s+(railway station|train station|bus station|metro station|airport|international airport|station)$/i;

/** Short label for feed header (mobile-friendly). Full place name stays in filter/search. */
export function feedHeaderLabelFromSuggestion(
    s: LocationSuggestion,
    parsed: ParsedPlaceFeed = parsedPlaceFeedFromSuggestion(s)
): string {
    const maxLen = 20;
    let base =
        cleanPart(s.display_name) ||
        (s.type === 'venue' || s.type === 'landmark' ? parsed.local : '') ||
        parsed.displayName ||
        parsed.local;

    base = base.split(',')[0].trim().replace(VENUE_SUFFIX_RE, '').trim();

    if (base.length > maxLen) {
        const words = base.split(/\s+/).filter(Boolean);
        if (words.length > 2) {
            base = words.slice(-2).join(' ');
        }
    }

    if (base.length > maxLen) {
        return `${base.slice(0, maxLen - 1).trimEnd()}…`;
    }

    return base || parsed.local.slice(0, maxLen);
}

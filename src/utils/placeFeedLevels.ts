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

/** Build local / regional / national feed targets from a Places suggestion. */
export function parsedPlaceFeedFromSuggestion(s: LocationSuggestion): ParsedPlaceFeed {
    const fullName = cleanPart(s.name);
    const national = cleanPart(s.national) || cleanPart(s.country);
    const local = cleanPart(s.local);
    const regional = cleanPart(s.regional);

    const parts = fullName.split(',').map((p) => p.trim()).filter(Boolean);
    const parsedLocal = local || parts[0] || fullName;
    const parsedNational = national || parts[parts.length - 1] || parsedLocal;
    const parsedRegional =
        regional || (parts.length >= 3 ? parts[parts.length - 2] : parts.length === 2 ? parts[1] : parsedLocal);

    let defaultScope: FeedScope = 'local';
    if (parts.length <= 1 && parsedNational) {
        defaultScope = 'national';
    } else if (parts.length === 2) {
        defaultScope = 'regional';
    }

    const options = uniqueOptions([
        { scope: 'national', label: `National · ${parsedNational}`, filter: parsedNational },
        { scope: 'regional', label: `Regional · ${parsedRegional}`, filter: parsedRegional },
        { scope: 'local', label: `Local · ${parsedLocal}`, filter: parsedLocal },
    ]);

    const defaultOption =
        options.find((o) => o.scope === defaultScope) || options[0] || {
            scope: 'local' as const,
            label: `Local · ${parsedLocal}`,
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

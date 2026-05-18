import { getApiBaseUrl } from './apiBaseUrl';
import { isLaravelApiEnabled } from '../config/runtimeEnv';

export type PlaceSummaryFact = {
    label: string;
    value: string;
};

export type PlaceSummary = {
    name: string;
    formatted_address?: string | null;
    summary: string;
    summary_source?: string | null;
    tagline?: string | null;
    facts?: PlaceSummaryFact[];
    /** e.g. "Summarized with Gemini" when Google AI summaries are used */
    attribution?: string | null;
};

/** Mirrors laravel-backend storage/app/data/locations.json for last-resort offline. */
const GAZETTEER_SNIPPETS: Array<{ name: string; country?: string; type: string }> = [
    { name: 'Finglas', country: 'Ireland', type: 'local' },
    { name: 'Artane', country: 'Ireland', type: 'local' },
    { name: 'Dublin', country: 'Ireland', type: 'city' },
    { name: 'Cork', country: 'Ireland', type: 'city' },
    { name: 'Paris', country: 'France', type: 'city' },
    { name: 'London', country: 'United Kingdom', type: 'city' },
    { name: 'Ireland', type: 'country' },
    { name: 'France', type: 'country' },
    { name: 'United Kingdom', type: 'country' },
];

export function isThinPlaceSummary(summary: string): boolean {
    const text = summary.trim();
    if (!text) return true;
    if (text.length < 60) return true;
    if (text.length < 160 && /\bis a (city|country|local area|major city center)\b/i.test(text)) {
        return true;
    }
    if (text.length < 120 && /\bis classified as\b/i.test(text)) {
        return true;
    }
    return false;
}

function truncateAtSentence(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    const chunk = text.slice(0, maxLen);
    const match = chunk.match(/^(.+[.!?])\s/);
    if (match) return match[1].trim();
    return `${chunk.trim()}…`;
}

function primaryFromLabel(label: string): string {
    return label.split(',')[0]?.trim() || label.trim();
}

function countryFromLabel(label: string): string | null {
    const parts = label.split(',').map((p) => p.trim()).filter(Boolean);
    return parts.length >= 2 ? parts[parts.length - 1] : null;
}

/**
 * Wikipedia REST + opensearch — works from the phone browser when Laravel is unreachable.
 * @see https://en.wikipedia.org/api/rest_v1/
 */
export async function fetchWikipediaPlaceSummaryClient(
    label: string,
    signal?: AbortSignal
): Promise<PlaceSummary | null> {
    const trimmed = label.trim();
    if (!trimmed) return null;

    const primary = primaryFromLabel(trimmed);
    const country = countryFromLabel(trimmed);
    const searchTerm = country ? `${primary}, ${country}` : primary;

    try {
        const searchUrl = new URL('https://en.wikipedia.org/w/api.php');
        searchUrl.searchParams.set('action', 'opensearch');
        searchUrl.searchParams.set('search', searchTerm);
        searchUrl.searchParams.set('limit', '1');
        searchUrl.searchParams.set('namespace', '0');
        searchUrl.searchParams.set('format', 'json');
        searchUrl.searchParams.set('origin', '*');

        const searchRes = await fetch(searchUrl.toString(), { signal });
        if (!searchRes.ok) return null;

        const searchData = await searchRes.json();
        const title = Array.isArray(searchData?.[1]) ? String(searchData[1][0] ?? '').trim() : '';
        if (!title) return null;

        const pageUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
            title.replace(/ /g, '_')
        )}`;
        const pageRes = await fetch(pageUrl, { signal });
        if (!pageRes.ok) return null;

        const page = await pageRes.json();
        if (page?.type === 'disambiguation') return null;

        const extract = typeof page?.extract === 'string' ? page.extract.trim() : '';
        const description = typeof page?.description === 'string' ? page.description.trim() : '';
        if (!extract && !description) return null;

        const name = typeof page?.title === 'string' && page.title.trim() ? page.title.trim() : primary;

        return {
            name,
            formatted_address: country ? `${name}, ${country}` : trimmed,
            summary: truncateAtSentence(extract || description, 420),
            tagline: description || null,
            summary_source: 'client_wikipedia',
            facts: country ? [{ label: 'Country', value: country }] : undefined,
        };
    } catch (err) {
        if (signal?.aborted) return null;
        return null;
    }
}

function typePhrase(type: string): string {
    switch (type) {
        case 'city':
            return 'city';
        case 'local':
            return 'local area';
        case 'country':
            return 'country';
        default:
            return 'place';
    }
}

/** Last-resort stub when both API and Wikipedia fail. */
export function buildClientPlaceSummaryFallback(label: string): PlaceSummary | null {
    const trimmed = label.trim();
    if (!trimmed) return null;

    const primary = primaryFromLabel(trimmed);
    const needle = primary.toLowerCase();

    for (const entry of GAZETTEER_SNIPPETS) {
        const name = entry.name;
        if (name.toLowerCase() !== needle && !trimmed.toLowerCase().startsWith(name.toLowerCase())) {
            continue;
        }
        const phrase = typePhrase(entry.type);
        const country = entry.country?.trim();
        const summary = country
            ? `${name} is a ${phrase} in ${country}. Be the first to share what's happening here.`
            : `${name} is a ${phrase}. Be the first to share what's happening here.`;

        return {
            name,
            formatted_address: country ? `${name}, ${country}` : name,
            summary,
            summary_source: 'client_gazetteer_fallback',
        };
    }

    return {
        name: primary,
        formatted_address: trimmed,
        summary: `Discover ${primary}. Be the first to share what's happening here.`,
        summary_source: 'client_generic_fallback',
    };
}

function buildSummaryUrl(base: string, params: Record<string, string>): string {
    const normalizedBase = base.replace(/\/$/, '');
    const path = `${normalizedBase}/search/places/summary`;
    const url = path.startsWith('http')
        ? new URL(path)
        : new URL(path, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    return url.toString();
}

/** Vite /api proxy first; on phone LAN also try host:8000 (CORS allowed in Laravel). */
function summaryRequestUrls(params: Record<string, string>): string[] {
    const urls: string[] = [];
    const seen = new Set<string>();

    const add = (base: string) => {
        const u = buildSummaryUrl(base, params);
        if (!seen.has(u)) {
            seen.add(u);
            urls.push(u);
        }
    };

    add(getApiBaseUrl());

    if (typeof window !== 'undefined') {
        const { hostname, protocol } = window.location;
        const onLan = hostname !== 'localhost' && hostname !== '127.0.0.1';
        if (onLan) {
            const scheme = protocol === 'https:' ? 'https' : 'http';
            add(`${scheme}://${hostname}:8000/api`);
        }
    }

    return urls;
}

function parseSummaryResponse(data: unknown, fallbackLabel: string): PlaceSummary | null {
    const summary = typeof (data as { summary?: string })?.summary === 'string'
        ? (data as { summary: string }).summary.trim()
        : '';
    if (!summary) return null;

    const facts = Array.isArray((data as { facts?: unknown }).facts)
        ? (data as { facts: Array<{ label?: string; value?: string }> }).facts
              .map((f) => ({
                  label: String(f.label ?? '').trim(),
                  value: String(f.value ?? '').trim(),
              }))
              .filter((f) => f.label && f.value)
        : undefined;

    const d = data as {
        name?: string;
        formatted_address?: string | null;
        summary_source?: string;
        tagline?: string;
        attribution?: string;
    };

    return {
        name: typeof d.name === 'string' && d.name.trim() ? d.name.trim() : fallbackLabel,
        formatted_address: d.formatted_address ?? null,
        summary,
        summary_source: d.summary_source ?? null,
        tagline: typeof d.tagline === 'string' ? d.tagline.trim() || null : null,
        facts: facts?.length ? facts : undefined,
        attribution: typeof d.attribution === 'string' ? d.attribution.trim() || null : null,
    };
}

async function fetchFromBackend(
    label: string,
    placeId: string | null | undefined,
    signal?: AbortSignal
): Promise<PlaceSummary | null> {
    const params: Record<string, string> = { label };
    if (placeId?.trim()) params.place_id = placeId.trim();

    for (const url of summaryRequestUrls(params)) {
        try {
            const res = await fetch(url, { signal });
            if (!res.ok) continue;
            const data = await res.json();
            const parsed = parseSummaryResponse(data, label);
            if (parsed) return parsed;
        } catch {
            // try next URL
        }
    }
    return null;
}

async function resolveRichSummary(
    label: string,
    placeId: string | null | undefined,
    signal?: AbortSignal
): Promise<PlaceSummary | null> {
    if (isLaravelApiEnabled()) {
        const fromApi = await fetchFromBackend(label, placeId, signal);
        if (fromApi && !isThinPlaceSummary(fromApi.summary)) {
            return fromApi;
        }

        const wiki = await fetchWikipediaPlaceSummaryClient(label, signal);
        if (wiki) {
            return {
                ...wiki,
                facts: fromApi?.facts?.length ? fromApi.facts : wiki.facts,
                attribution: fromApi?.attribution ?? wiki.attribution,
            };
        }
    }

    const wikiOnly = await fetchWikipediaPlaceSummaryClient(label, signal);
    if (wikiOnly) return wikiOnly;

    return buildClientPlaceSummaryFallback(label);
}

export async function fetchPlaceSummary(
    label: string,
    placeId?: string | null,
    signal?: AbortSignal
): Promise<PlaceSummary | null> {
    const trimmed = label.trim();
    if (!trimmed) return null;

    return resolveRichSummary(trimmed, placeId, signal);
}

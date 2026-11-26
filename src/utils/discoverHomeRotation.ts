import { fetchPostsPage } from '../api/client';

/** Welcoming lines. `{name}` is the handle with the @place suffix removed. */
export const DISCOVER_GREETINGS = [
    "Let's go social traveling, {name}",
    'Where in the world are we dropping next, {name}?',
    'Explore any street, anywhere, {name}',
    "What's happening around the corner, {name}?",
    'Pick a place to explore today, {name}',
    'Ready when you are, {name}',
    'Somewhere new is waiting, {name}',
    "Let's see what's out there, {name}",
] as const;

const FALLBACK_CITIES = [
    'Paris', 'London', 'Rome', 'Madrid', 'Berlin', 'Tokyo',
    'New York', 'Sydney', 'Toronto', 'Singapore', 'Amsterdam', 'Dublin',
];

const FALLBACK_HUBS = [
    'New York', 'London', 'Tokyo', 'Berlin', 'Paris', 'Los Angeles', 'Sydney', 'Dublin',
];

const FALLBACK_STREETS = [
    'Old Cabra Road', 'Grafton Street', "O'Connell Street", 'Camden Street', 'Henry Street',
];

const STREET_RE = /\b(road|street|st\.|avenue|ave\.?|lane|quay|drive|terrace|parade|square|row)\b/i;

export type DiscoverPromptIcon = 'compass-outline' | 'pulse-outline' | 'location-outline';

export type DiscoverPrompt = {
    city: string;
    label: string;
    icon: DiscoverPromptIcon;
};

export type DiscoverActivePlaces = {
    cities: string[];
    streets: string[];
    neighborhoods: string[];
};

type CountedPlace = { name: string; count: number };

/** `JoJo@Dublin` and `@JoJo@Dublin` both become `JoJo`. */
export function discoverDisplayName(handle?: string | null, fallbackName?: string | null): string {
    const fromHandle = String(handle || '').replace(/^@/, '').split('@')[0].trim();
    if (fromHandle) return fromHandle;
    const fromName = String(fallbackName || '').split('@')[0].trim().split(/\s+/)[0];
    return fromName || 'Friend';
}

export function discoverGreeting(index: number, name: string): string {
    const template = DISCOVER_GREETINGS[((index % DISCOVER_GREETINGS.length) + DISCOVER_GREETINGS.length) % DISCOVER_GREETINGS.length];
    return template.replace('{name}', name);
}

function readPlace(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function isStreet(name: string): boolean {
    return STREET_RE.test(name);
}

function tally(names: string[]): CountedPlace[] {
    const map = new Map<string, CountedPlace>();
    for (const raw of names) {
        const name = raw.trim();
        if (name.length < 2) continue;
        const key = name.toLowerCase();
        const prev = map.get(key);
        if (prev) prev.count += 1;
        else map.set(key, { name, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function pickPlace(active: string[], fallback: string[], tick: number, blocked: Set<string>): string {
    const fromActive = tally(active).map((place) => place.name).filter((name) => !blocked.has(name.toLowerCase()));
    const pool = fromActive.length > 0
        ? fromActive
        : fallback.filter((name) => !blocked.has(name.toLowerCase()));
    if (pool.length === 0) return fallback[0];
    const index = ((tick % pool.length) + pool.length) % pool.length;
    return pool[index];
}

/**
 * Recent posts' author home places — the same local/regional strings the feed matches.
 * Falls back to an empty pool when the feed can't be read; callers use the curated list.
 */
export async function loadDiscoverActivePlaces(): Promise<DiscoverActivePlaces> {
    try {
        const response = await fetchPostsPage(0, 40, ' ') as { items?: unknown };
        const items = Array.isArray(response?.items) ? response.items : [];
        const cities: string[] = [];
        const streets: string[] = [];
        const neighborhoods: string[] = [];
        for (const item of items) {
            if (!item || typeof item !== 'object') continue;
            const row = item as Record<string, unknown>;
            const author = row.user && typeof row.user === 'object' ? row.user as Record<string, unknown> : {};
            const local = readPlace(row.userLocal) || readPlace(author.location_local) || readPlace(author.local);
            const regional = readPlace(row.userRegional) || readPlace(author.location_regional) || readPlace(author.regional);
            const national = readPlace(row.userNational) || readPlace(author.location_national) || readPlace(author.national);
            const nationalKey = national.toLowerCase();
            if (regional && regional.toLowerCase() !== nationalKey) cities.push(regional);
            if (!local || local.toLowerCase() === nationalKey) continue;
            if (regional && local.toLowerCase() === regional.toLowerCase()) continue;
            if (isStreet(local)) streets.push(local);
            else neighborhoods.push(local);
        }
        return { cities, streets, neighborhoods };
    } catch {
        return { cities: [], streets: [], neighborhoods: [] };
    }
}

/** Compass city, pulse hub, and pin street — three different places. */
export function buildDiscoverPrompts(places: DiscoverActivePlaces, tick: number): DiscoverPrompt[] {
    const blocked = new Set<string>();
    const city = pickPlace(places.cities, FALLBACK_CITIES, tick, blocked);
    blocked.add(city.toLowerCase());
    const hub = pickPlace(places.cities, FALLBACK_HUBS, tick + 1, blocked);
    blocked.add(hub.toLowerCase());
    const streetPool = places.streets.length > 0 ? places.streets : places.neighborhoods;
    const street = pickPlace(streetPool, FALLBACK_STREETS, tick, blocked);
    return [
        { city, label: `Let's go to the ${city} feed`, icon: 'compass-outline' },
        { city: hub, label: `What's happening in ${hub}`, icon: 'pulse-outline' },
        { city: street, label: `Drop into ${street}`, icon: 'location-outline' },
    ];
}

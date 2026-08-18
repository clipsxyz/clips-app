/**
 * Live Google Places / Geocoding helpers for passport location pickers.
 * Prefers Laravel (`GOOGLE_MAPS_API_KEY` server-side) so web avoids CORS and the key stays off-device.
 * No hardcoded city/region mock tables.
 */

import { getApiBaseUrl } from '../api/apiBaseUrl';
import { geocodeLocation } from '../api/locations';
import { getRuntimeEnv, isLaravelApiEnabled } from '../config/runtimeEnv';

export interface LocationResult {
  name: string;
  placeId?: string;
  types?: string[];
}

/** Client env aliases for the same Google Cloud key as `laravel-backend` GOOGLE_MAPS_API_KEY. */
export function getGoogleMapsApiKey(): string {
  return (
    getRuntimeEnv('VITE_GOOGLE_MAPS_API_KEY') ||
    getRuntimeEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY') ||
    ''
  ).trim();
}

function shortPlaceName(raw: string): string {
  const first = String(raw || '')
    .split(',')[0]
    .trim();
  return first.replace(/^County\s+/i, '').trim() || first;
}

function buildSearchUrl(params: Record<string, string>): string {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const url = new URL(
    `${base}/search/places`,
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
  );
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

async function laravelPlaceSearch(params: {
  q: string;
  limit?: number;
  mode?: 'all' | 'location' | 'venue' | 'landmark';
  level?: 'country' | 'region' | 'local';
  country?: string;
  region?: string;
  signal?: AbortSignal;
}): Promise<LocationResult[]> {
  if (!isLaravelApiEnabled()) return [];

  const query: Record<string, string> = {
    q: params.q,
    limit: String(Math.min(params.limit ?? 20, 20)),
    mode: params.mode || 'location',
  };
  if (params.level) query.level = params.level;
  if (params.country?.trim()) query.country = params.country.trim();
  if (params.region?.trim()) query.region = params.region.trim();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const onAbort = () => controller.abort();
  if (params.signal) {
    if (params.signal.aborted) {
      clearTimeout(timer);
      throw new DOMException('Aborted', 'AbortError');
    }
    params.signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    const res = await fetch(buildSearchUrl(query), { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((item: Record<string, unknown>) => {
        const display =
          (typeof item.display_name === 'string' && item.display_name) ||
          (typeof item.regional === 'string' && params.level === 'region' && item.regional) ||
          (typeof item.local === 'string' && params.level === 'local' && item.local) ||
          (typeof item.name === 'string' && item.name) ||
          '';
        const name = shortPlaceName(display);
        if (!name) return null;
        return {
          name,
          placeId: typeof item.place_id === 'string' ? item.place_id : undefined,
        } as LocationResult;
      })
      .filter(Boolean) as LocationResult[];
  } catch (e) {
    if (params.signal?.aborted) throw e;
    return [];
  } finally {
    clearTimeout(timer);
    params.signal?.removeEventListener('abort', onAbort);
  }
}

function dedupeSort(results: LocationResult[]): LocationResult[] {
  const seen = new Set<string>();
  const out: LocationResult[] = [];
  for (const item of results) {
    const key = item.name.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** Parallel seed queries — Places Autocomplete returns ~5 hits per input. */
async function harvestPlaceSearch(
  seeds: string[],
  base: {
    level: 'region' | 'local';
    country: string;
    region?: string;
  },
): Promise<LocationResult[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < seeds.length; i += 6) {
    chunks.push(seeds.slice(i, i + 6));
  }
  const collected: LocationResult[] = [];
  for (const chunk of chunks) {
    const batch = await Promise.all(
      chunk.map((q) =>
        laravelPlaceSearch({
          q,
          limit: 20,
          mode: 'location',
          level: base.level,
          country: base.country,
          region: base.region,
        }),
      ),
    );
    for (const rows of batch) collected.push(...rows);
  }
  return dedupeSort(collected);
}

/**
 * Administrative regions (states/counties/provinces) for a country — live Google via Laravel.
 */
export async function fetchRegionsForCountry(countryName: string): Promise<LocationResult[]> {
  const country = countryName.trim();
  if (!country) return [];

  if (!isLaravelApiEnabled()) {
    if (!getGoogleMapsApiKey()) {
      console.warn(`[googleMaps] No Laravel API and no VITE_GOOGLE_MAPS_API_KEY for ${country}`);
    }
    return [];
  }

  const letterSeeds = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));
  const seeds = Array.from(new Set([country, 'County', 'State', 'Province', ...letterSeeds]));

  const regions = await harvestPlaceSearch(seeds, { level: 'region', country });
  if (regions.length > 0) return regions;

  // Single-shot fallback if harvest was empty (rate limit / key issue).
  return dedupeSort(
    await laravelPlaceSearch({
      q: country,
      limit: 20,
      mode: 'location',
      level: 'region',
      country,
    }),
  );
}

/**
 * Local areas / cities within a region — live Google via Laravel.
 */
export async function fetchCitiesForRegion(
  regionName: string,
  countryName: string,
): Promise<LocationResult[]> {
  const region = regionName.trim();
  const country = countryName.trim();
  if (!region || !country) return [];

  if (!isLaravelApiEnabled()) {
    if (!getGoogleMapsApiKey()) {
      console.warn(`[googleMaps] No Laravel API and no maps key for ${region}, ${country}`);
    }
    return [];
  }

  const letterSeeds = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));
  const seeds = Array.from(new Set([region, `${region} City`, ...letterSeeds]));

  let locals = await harvestPlaceSearch(seeds, {
    level: 'local',
    country,
    region,
  });

  // If signup-level filter was too strict, retry without level (still scoped by q + country).
  if (locals.length === 0) {
    const loose = await laravelPlaceSearch({
      q: region,
      limit: 20,
      mode: 'location',
      country,
      region,
    });
    locals = dedupeSort(loose);
  }

  return locals;
}

/** Resolve a place label / place_id to lat/lng via Laravel Geocoding. */
export async function geocodePlace(options: {
  placeId?: string | null;
  q?: string | null;
  signal?: AbortSignal;
}): Promise<{ latitude: number; longitude: number; label: string; placeId?: string | null } | null> {
  const resolved = await geocodeLocation(options);
  if (!resolved) return null;
  return {
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    label: resolved.label,
    placeId: resolved.place_id ?? options.placeId ?? null,
  };
}

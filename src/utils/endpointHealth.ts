import { apiRequest } from '../api/client';

export type EndpointHealthResult = {
    name: string;
    ok: boolean;
    details?: string;
};

/**
 * Lightweight runtime endpoint check for local debugging.
 * Keeps checks safe/read-only.
 */
export async function runEndpointHealthCheck(): Promise<EndpointHealthResult[]> {
    const checks: Array<() => Promise<EndpointHealthResult>> = [
        async () => {
            try {
                await apiRequest('/health', { method: 'GET', timeoutMs: 3000 });
                return { name: 'GET /health', ok: true };
            } catch (e: any) {
                return { name: 'GET /health', ok: false, details: e?.message || 'failed' };
            }
        },
        async () => {
            try {
                await apiRequest('/search/places?q=dublin&limit=3&mode=all', { method: 'GET', timeoutMs: 5000 });
                return { name: 'GET /search/places', ok: true };
            } catch (e: any) {
                return { name: 'GET /search/places', ok: false, details: e?.message || 'failed' };
            }
        },
        async () => {
            try {
                await apiRequest('/search?q=dublin&types=locations&locationsLimit=3', { method: 'GET', timeoutMs: 5000 });
                return { name: 'GET /search', ok: true };
            } catch (e: any) {
                return { name: 'GET /search', ok: false, details: e?.message || 'failed' };
            }
        },
    ];

    const out: EndpointHealthResult[] = [];
    for (const check of checks) out.push(await check());
    return out;
}


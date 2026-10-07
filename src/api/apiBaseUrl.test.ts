import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/runtimeEnv', () => ({
    DEV_LAN_API_BASE_URL: 'http://192.168.1.9:8000/api',
    DEV_LOOPBACK_API_BASE_URL: 'http://127.0.0.1:8000/api',
    DEV_ANDROID_EMULATOR_API_BASE_URL: 'http://10.0.2.2:8000/api',
    getConfiguredApiEnvUrl: vi.fn(() => undefined),
    getPreferredRnApiHost: vi.fn(() => null),
    getReactNativeDefaultApiBaseUrl: vi.fn(() => null),
    isLoopbackApiHost: (url: string) => /localhost|127\.0\.0\.1/i.test(url),
    isReactNativeRuntime: vi.fn(() => false),
    rememberSuccessfulApiBaseUrl: vi.fn(),
    rewriteLoopbackApiUrlToLan: (url: string) => url,
}));

describe('apiBaseUrl upload helpers', () => {
    it('exports getApiBaseUrlCandidates and resolvePublicMediaUrl as functions', async () => {
        const mod = await import('./apiBaseUrl');
        expect(typeof mod.getApiBaseUrlCandidates).toBe('function');
        expect(typeof mod.resolvePublicMediaUrl).toBe('function');
        expect(mod.getApiBaseUrlCandidates().length).toBeGreaterThan(0);
        expect(mod.resolvePublicMediaUrl('/storage/foo.jpg')).toContain('/storage/foo.jpg');
    });
});

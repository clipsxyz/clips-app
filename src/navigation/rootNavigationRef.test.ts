import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-navigation/native', () => ({
    createNavigationContainerRef: () => ({
        isReady: () => false,
        reset: vi.fn(),
    }),
}));

describe('rootNavigationRef', () => {
    it('exports resetRootToScreen as a function (login post-auth navigation)', async () => {
        const mod = await import('./rootNavigationRef');
        expect(typeof mod.resetRootToScreen).toBe('function');
        expect(mod.rootNavigationRef).toBeTruthy();
        // Safe no-op when the container is not ready (unit/test env).
        expect(() => mod.resetRootToScreen('MainTabs')).not.toThrow();
    });
});

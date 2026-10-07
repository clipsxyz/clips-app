import { describe, expect, it } from 'vitest';
import { resetRootToScreen, rootNavigationRef } from './rootNavigationRef';

describe('rootNavigationRef', () => {
    it('exports resetRootToScreen as a function (login post-auth navigation)', () => {
        expect(typeof resetRootToScreen).toBe('function');
        expect(rootNavigationRef).toBeTruthy();
        // Safe no-op when the container is not ready (unit/test env).
        expect(() => resetRootToScreen('MainTabs')).not.toThrow();
    });
});

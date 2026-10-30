import { describe, expect, it } from 'vitest';
import { describeFetchError, isTransportNetworkError } from './httpClient';

describe('isTransportNetworkError', () => {
    it('matches React Native TypeError Network request failed', () => {
        const err = new TypeError('Network request failed');
        expect(isTransportNetworkError(err)).toBe(true);
    });

    it('matches CONNECTION_REFUSED', () => {
        const err = new Error('CONNECTION_REFUSED');
        err.name = 'ConnectionRefused';
        expect(isTransportNetworkError(err)).toBe(true);
    });
});

describe('describeFetchError', () => {
    it('explains 401', () => {
        const err = new Error('Unauthenticated');
        (err as { status?: number }).status = 401;
        expect(describeFetchError(err)).toContain('Session expired');
    });

    it('explains transport failure without throwing', () => {
        expect(describeFetchError(new TypeError('Network request failed'))).toContain('Cannot reach the server');
    });
});

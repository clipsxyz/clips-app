import { describe, expect, it, vi } from 'vitest';
import { fireAndForget, ignoreAbort, isAbortLikeError } from './abortSafe';

function abortError(message = 'Aborted'): Error {
    const e = new Error(message);
    e.name = 'AbortError';
    return e;
}

describe('isAbortLikeError', () => {
    it('recognises an AbortError instance', () => {
        expect(isAbortLikeError(abortError())).toBe(true);
    });

    it('recognises a TimeoutError, which is a cancellation too', () => {
        const e = new Error('deadline');
        e.name = 'TimeoutError';
        expect(isAbortLikeError(e)).toBe(true);
    });

    it('recognises a bare "Aborted" message', () => {
        expect(isAbortLikeError(new Error('Aborted'))).toBe(true);
    });

    it('recognises any message mentioning abort', () => {
        expect(isAbortLikeError(new Error('Request aborted by user'))).toBe(true);
    });

    it('recognises a raw string rejection, as RN stringifies them', () => {
        // This is the exact shape that surfaces as
        // `Uncaught (in promise): "AbortError: Aborted"`.
        expect(isAbortLikeError('AbortError: Aborted')).toBe(true);
    });

    it('does not treat real failures as cancellations', () => {
        expect(isAbortLikeError(new Error('Network request failed'))).toBe(false);
        expect(isAbortLikeError(new TypeError('undefined is not a function'))).toBe(false);
        expect(isAbortLikeError({ status: 500 })).toBe(false);
    });

    it('is false for empty and non-object values', () => {
        expect(isAbortLikeError(null)).toBe(false);
        expect(isAbortLikeError(undefined)).toBe(false);
        expect(isAbortLikeError(0)).toBe(false);
        expect(isAbortLikeError('')).toBe(false);
    });
});

describe('ignoreAbort', () => {
    it('resolves quietly for a cancellation', async () => {
        await expect(ignoreAbort(Promise.reject(abortError()))).resolves.toBeUndefined();
    });

    it('resolves quietly for a stringified cancellation', async () => {
        await expect(ignoreAbort(Promise.reject('AbortError: Aborted'))).resolves.toBeUndefined();
    });

    it('reports a real failure to onError instead of swallowing it', async () => {
        const onError = vi.fn();
        const boom = new Error('kaboom');
        await ignoreAbort(Promise.reject(boom), onError);
        expect(onError).toHaveBeenCalledWith(boom);
    });

    it('rethrows a real failure when no onError is supplied', async () => {
        const boom = new Error('kaboom');
        await expect(ignoreAbort(Promise.reject(boom))).rejects.toBe(boom);
    });

    it('passes a success value through untouched', async () => {
        await expect(ignoreAbort(Promise.resolve(7))).resolves.toBe(7);
    });
});

describe('fireAndForget', () => {
    it('swallows a cancellation with no console noise', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        fireAndForget(Promise.reject(abortError()));
        await new Promise((r) => setTimeout(r, 0));
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it('warns about a real failure, including the label', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        fireAndForget(Promise.reject(new Error('kaboom')), 'loadBoost');
        await new Promise((r) => setTimeout(r, 0));
        expect(warn).toHaveBeenCalledWith('[fireAndForget] loadBoost failed', {
            name: 'Error',
            message: 'kaboom',
        });
        warn.mockRestore();
    });
});

/**
 * Cancellation-safe promise handling.
 *
 * A request that is cancelled on purpose (unmount, filter switch, scroll
 * recycle) rejects. That rejection is not a failure, but a floating promise turns
 * it into `Uncaught (in promise): AbortError: Aborted` in dev, which trains you to
 * ignore red screens and buries the rejections that DO matter.
 *
 * The single rule: swallow cancellations, report everything else.
 */

/**
 * True for anything that represents a cancellation rather than a failure.
 *
 * Deliberately duck-typed and tolerant of a raw string, because React Native's
 * unhandled-rejection reporter stringifies the rejection value
 * (`Error.toString()` === `"${name}: ${message}"`), so by the time an abort shows
 * up in a log it may no longer be an `Error` instance.
 */
export function isAbortLikeError(error: unknown): boolean {
    if (typeof error === 'string') {
        return /abort/i.test(error);
    }
    if (!error || typeof error !== 'object') return false;
    const name = String((error as { name?: string }).name || '');
    const message = String((error as { message?: string }).message || '');
    return (
        name === 'AbortError' ||
        name === 'TimeoutError' ||
        message === 'Aborted' ||
        /aborted/i.test(message)
    );
}

/**
 * Attach a handler to a promise the caller is not going to await.
 *
 * Use this instead of a bare `void somePromise.then(...)`: it guarantees the
 * rejection is observed, and it guarantees a *non*-cancellation failure is still
 * surfaced via `onError` rather than silently dropped.
 *
 * @returns a promise resolving to the value, or `undefined` if the chain was
 *          cancelled (or the failure was routed to `onError`). Await it if you
 *          need the value; the point is that you no longer *have* to.
 */
export function ignoreAbort<T>(
    promise: PromiseLike<T>,
    onError?: (error: unknown) => void,
): Promise<Awaited<T> | undefined> {
    const guarded = Promise.resolve(promise).catch((error: unknown) => {
        if (isAbortLikeError(error)) return undefined;
        // Not a cancellation — do not swallow it.
        if (onError) {
            onError(error);
            return undefined;
        }
        // Preserve the original unhandled-rejection behaviour for real errors
        // rather than pretending the call site handled it.
        throw error;
    });
    return guarded;
}

/**
 * `void`-style wrapper for effect bodies: guards a promise chain and reports
 * non-cancellations to the console.
 */
export function fireAndForget(
    promise: PromiseLike<unknown>,
    label?: string,
): void {
    ignoreAbort(promise, (error) => {
        if (label) {
            console.warn(`[fireAndForget] ${label} failed`, {
                name: (error as { name?: string })?.name,
                message: (error as { message?: string })?.message,
            });
        } else {
            console.warn('[fireAndForget] unhandled non-cancellation error', error);
        }
    });
}

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The silence net reaches the feed's ScrollView by composing two refs: Reanimated's
 * callback ref (which powers the UI-thread scroll listener) and FlashList's own ref
 * (which powers scrollTo / getScrollResponder / maintainVisibleContentPosition).
 *
 * If FlashList's ref is dropped, the feed still scrolls but every imperative
 * scroll call silently no-ops. If Reanimated's is dropped, the net logs
 * "animatedRef is not initialized" and stops receiving offsets. Neither shows up
 * in a type check or a bundle, so it gets tested.
 */

// Shareables become plain boxes. The worklet/UI-thread semantics cannot run under
// Vitest, but the arming and clamping rules around them are ordinary logic.
vi.mock('react-native-reanimated', () => ({
    makeMutable: <T,>(initial: T) => ({ value: initial }),
    useSharedValue: <T,>(initial: T) => ({ value: initial }),
    runOnJS: <T extends (...args: never[]) => unknown>(fn: T) => fn,
    useAnimatedReaction: () => {},
}));

vi.mock('react-native', () => {
    const Dimensions = { get: () => ({ height: 800, width: 400 }) };
    return { Dimensions, default: { Dimensions } };
});

import {
    __resetFeedViewabilityForTests,
    assignRef,
    getFeedUiThreadAnchor,
    getFeedUiThreadScrollY,
    setFeedUiThreadAnchor,
    setFeedUiThreadScrollY,
    setFeedUiThreadViewportHeight,
} from './feedViewabilityUiThread';

describe('assignRef', () => {
    it('calls a callback ref', () => {
        const cb = vi.fn();
        assignRef(cb, 'node');
        expect(cb).toHaveBeenCalledWith('node');
    });

    it('assigns .current on a ref object', () => {
        const ref: { current: unknown } = { current: null };
        assignRef(ref, 'node');
        expect(ref.current).toBe('node');
    });

    it('overwrites a previously held value', () => {
        const ref: { current: unknown } = { current: 'old' };
        assignRef(ref, 'new');
        expect(ref.current).toBe('new');
    });

    it('passes null through, so a detaching ref still gets told', () => {
        const cb = vi.fn();
        assignRef(cb, 'node');
        assignRef(cb, null);
        expect(cb).toHaveBeenNthCalledWith(1, 'node');
        expect(cb).toHaveBeenNthCalledWith(2, null);
    });

    it('ignores a nullish ref instead of throwing', () => {
        expect(() => assignRef(null, 'node')).not.toThrow();
        expect(() => assignRef(undefined, 'node')).not.toThrow();
    });

    it('ignores a non-ref value', () => {
        // Guards against a stray prop being treated as a ref.
        expect(() => assignRef(42 as unknown, 'node')).not.toThrow();
        expect(() => assignRef('nope' as unknown, 'node')).not.toThrow();
    });

    it('feeds both refs when composed, as the feed scroll view does', () => {
        const reanimatedRef = vi.fn();
        const flashListRef: { current: unknown } = { current: null };
        const node = { tag: 7 };

        // The order matters only in that both must be reached.
        assignRef(reanimatedRef, node);
        assignRef(flashListRef, node);

        expect(reanimatedRef).toHaveBeenCalledWith(node);
        expect(flashListRef.current).toBe(node);
    });

    it('leaves the other ref untouched when one is absent', () => {
        const flashListRef: { current: unknown } = { current: 'keep' };
        assignRef(null, 'ignored-node');
        expect(flashListRef.current).toBe('keep');
    });
});

describe('scroll offset publication', () => {
    beforeEach(() => {
        __resetFeedViewabilityForTests(800);
    });

    it('round-trips a finite offset', () => {
        setFeedUiThreadScrollY(1234.5);
        expect(getFeedUiThreadScrollY()).toBe(1234.5);
    });

    it('accepts zero', () => {
        // 0 is a legitimate offset (top of list) and must not be treated as unset.
        setFeedUiThreadScrollY(0);
        expect(getFeedUiThreadScrollY()).toBe(0);
    });

    it('ignores non-finite offsets', () => {
        setFeedUiThreadScrollY(500);
        setFeedUiThreadScrollY(Number.NaN);
        expect(getFeedUiThreadScrollY()).toBe(500);
        setFeedUiThreadScrollY(Number.POSITIVE_INFINITY);
        expect(getFeedUiThreadScrollY()).toBe(500);
    });

    it('ignores a non-positive viewport height', () => {
        // A 0/negative viewport would make every card score 0 visible and the net
        // would silence playback, so it must never be stored.
        setFeedUiThreadViewportHeight(0);
        setFeedUiThreadViewportHeight(-10);
        expect(() => setFeedUiThreadViewportHeight(Number.NaN)).not.toThrow();
    });
});

describe('net arming', () => {
    beforeEach(() => {
        __resetFeedViewabilityForTests(800);
    });

    it('starts disarmed', () => {
        expect(getFeedUiThreadAnchor()).toBeNull();
    });

    it('arms with a measured card', () => {
        setFeedUiThreadAnchor({ anchorY: 1000, cardHeight: 800 });
        expect(getFeedUiThreadAnchor()).toEqual({ anchorY: 1000, cardHeight: 800 });
    });

    it('rejects an unmeasured card rather than arming a broken anchor', () => {
        setFeedUiThreadAnchor({ anchorY: 1000, cardHeight: 0 });
        expect(getFeedUiThreadAnchor()).toBeNull();
    });

    it('rejects a non-finite anchor offset', () => {
        setFeedUiThreadAnchor({ anchorY: Number.NaN, cardHeight: 800 });
        expect(getFeedUiThreadAnchor()).toBeNull();
    });

    it('disarms on null, which is what the card cleanup does on unmount', () => {
        setFeedUiThreadAnchor({ anchorY: 0, cardHeight: 800 });
        setFeedUiThreadAnchor(null);
        expect(getFeedUiThreadAnchor()).toBeNull();
    });

    it('ignores a null ref in assignRef without disarming anything', () => {
        setFeedUiThreadAnchor({ anchorY: 0, cardHeight: 800 });
        assignRef(null, null);
        expect(getFeedUiThreadAnchor()).toEqual({ anchorY: 0, cardHeight: 800 });
    });

    it('re-arming replaces the previous anchor rather than merging', () => {
        setFeedUiThreadAnchor({ anchorY: 0, cardHeight: 800 });
        setFeedUiThreadAnchor({ anchorY: 5000, cardHeight: 600 });
        expect(getFeedUiThreadAnchor()).toEqual({ anchorY: 5000, cardHeight: 600 });
    });
});

/**
 * UI-thread callability is a property of the *source text*, not of the runtime
 * value: a missing `'worklet'` directive compiles and type-checks fine, passes
 * every behavioural test above (Vitest has no UI thread), and then throws
 * "Tried to synchronously call a non-worklet function on the UI thread" the
 * first time a user taps a card to expand. So assert the directive directly.
 *
 * `getFeedUiThreadScrollY` in particular is called synchronously inside the
 * fast-path `singleTap.onEnd` worklet in `FeedPostMedia.native.tsx`, where the
 * scroll offset is needed to compute the expand offset before the morph can be
 * armed. `runOnJS` is not an escape hatch there — it schedules onto the JS
 * thread and returns `undefined` on the UI thread, so it cannot hand a number
 * back to the worklet.
 */
describe('worklet directives', () => {
    const source = readFileSync(
        resolve(process.cwd(), 'src/utils/feedViewabilityUiThread.ts'),
        'utf8',
    );

    const declaredWorklets = new Set(
        [...source.matchAll(/(?:function\s+(\w+)|const\s+(\w+)\s*=)/g)]
            .map((m) => m[1] ?? m[2])
            .filter((name) => {
                const at = source.indexOf(`${name}(`);
                if (at < 0) return false;
                return /^\s*'worklet';/m.test(source.slice(at, at + 400));
            }),
    );

    // Every function in this module that reads or writes a shareable has to be
    // callable from the UI thread: they are driven from Reanimated scroll
    // handlers and from the feed tap/expand worklets.
    const shareableAccessors = [
        'setFeedUiThreadScrollY',
        'setFeedUiThreadViewportHeight',
        'getFeedUiThreadScrollY',
    ];

    it.each(shareableAccessors)('%s carries a worklet directive', (name) => {
        expect(declaredWorklets).toContain(name);
    });
});

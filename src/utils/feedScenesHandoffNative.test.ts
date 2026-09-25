import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    consumeFeedVideoHandoff,
    peekFeedVideoHandoff,
    peekScenesReturnHandoff,
    setFeedVideoHandoff,
} from './feedScenesHandoffNative';

const POST = 'post-1';
const OTHER = 'post-2';

describe('feedScenesHandoffNative', () => {
    beforeEach(() => {
        vi.useRealTimers();
        // Clear module state between tests.
        consumeFeedVideoHandoff(POST);
        consumeFeedVideoHandoff(OTHER);
    });

    it('round-trips a handoff and consumes it once', () => {
        setFeedVideoHandoff(POST, { currentTime: 12.5, muted: false, fromScenes: true });
        expect(peekFeedVideoHandoff(POST)?.currentTime).toBe(12.5);
        expect(consumeFeedVideoHandoff(POST)?.currentTime).toBe(12.5);
        expect(consumeFeedVideoHandoff(POST)).toBeUndefined();
    });

    // Regression: a remounted player reports t≈0 before seeking. That must not wipe
    // the timestamp Scenes handed us.
    it('does not let a t≈0 progress write clobber a Scenes resume time', () => {
        setFeedVideoHandoff(POST, { currentTime: 12.5, muted: false, fromScenes: true });
        setFeedVideoHandoff(POST, { currentTime: 0, muted: false });
        expect(peekFeedVideoHandoff(POST)?.currentTime).toBe(12.5);
    });

    it('still accepts a genuine forward progress write', () => {
        setFeedVideoHandoff(POST, { currentTime: 12.5, muted: false, fromScenes: true });
        setFeedVideoHandoff(POST, { currentTime: 20, muted: false });
        expect(peekFeedVideoHandoff(POST)?.currentTime).toBe(20);
    });

    it('prefers the Scenes post over other non-Scenes entries', () => {
        setFeedVideoHandoff(OTHER, { currentTime: 3, muted: true });
        setFeedVideoHandoff(POST, { currentTime: 12.5, muted: false, fromScenes: true });
        expect(peekScenesReturnHandoff()?.postId).toBe(POST);
    });

    // Regression: both call sites peek non-destructively, so an unconsumed
    // fromScenes entry used to hijack focus on every later feed visit.
    it('expires a stale Scenes return instead of hijacking focus forever', () => {
        vi.useFakeTimers();
        setFeedVideoHandoff(POST, { currentTime: 12.5, muted: false, fromScenes: true });
        expect(peekScenesReturnHandoff()?.postId).toBe(POST);

        vi.advanceTimersByTime(91_000);
        expect(peekScenesReturnHandoff()).toBeUndefined();
        // Entry is dropped, so it cannot be resurrected by a later visit either.
        expect(peekFeedVideoHandoff(POST)).toBeUndefined();
    });

    it('keeps a Scenes return alive within the TTL', () => {
        vi.useFakeTimers();
        setFeedVideoHandoff(POST, { currentTime: 12.5, muted: false, fromScenes: true });
        vi.advanceTimersByTime(60_000);
        expect(peekScenesReturnHandoff()?.postId).toBe(POST);
    });

    it('does not expire ordinary progress entries', () => {
        vi.useFakeTimers();
        setFeedVideoHandoff(POST, { currentTime: 5, muted: true });
        vi.advanceTimersByTime(10 * 60_000);
        expect(peekFeedVideoHandoff(POST)?.currentTime).toBe(5);
    });
});

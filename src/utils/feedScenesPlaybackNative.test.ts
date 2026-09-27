import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    setScenesPlaybackPlayer,
    stopScenesPlayback,
} from './feedScenesPlaybackNative';

/**
 * The fullscreen Scenes overlay runs in its own native Modal window, so it is
 * not in the feed's single-player slot. These tests pin the two properties that
 * separation has to hold:
 *
 *  - nothing in the slot store can pause it (it isn't in that store), and
 *  - navigation silences it synchronously, with no await in between.
 */
function makePlayer() {
    return { pause: vi.fn(), setVolume: vi.fn() };
}

afterEach(() => {
    setScenesPlaybackPlayer(null);
    vi.restoreAllMocks();
});

describe('stopScenesPlayback', () => {
    it('silences the overlay synchronously', () => {
        const player = makePlayer();
        setScenesPlaybackPlayer(player);

        stopScenesPlayback();

        // Synchronously — no timers, no awaits between publish and stop.
        expect(player.setVolume).toHaveBeenCalledWith(0);
        expect(player.pause).toHaveBeenCalled();
    });

    it('releases the handle so a later stop cannot touch a dead player', () => {
        const player = makePlayer();
        setScenesPlaybackPlayer(player);
        stopScenesPlayback();

        player.pause.mockClear();
        stopScenesPlayback();

        expect(player.pause).not.toHaveBeenCalled();
    });

    it('is a no-op when no overlay is mounted', () => {
        // Every navigation path calls this unconditionally, including ones
        // taken when Scenes was never opened.
        expect(() => stopScenesPlayback()).not.toThrow();
    });

    it('is idempotent across repeated navigations', () => {
        const player = makePlayer();
        setScenesPlaybackPlayer(player);

        stopScenesPlayback();
        stopScenesPlayback();

        expect(player.pause).toHaveBeenCalledTimes(1);
    });

    it('survives an already-released ExoPlayer', () => {
        const player = {
            pause: () => {
                throw new Error('player already released');
            },
            setVolume: vi.fn(),
        };
        setScenesPlaybackPlayer(player);

        expect(() => stopScenesPlayback()).not.toThrow();
        // The handle is still released despite the throw.
        expect(() => stopScenesPlayback()).not.toThrow();
    });
});

describe('overlay lifecycle', () => {
    it('does not silence on detach — only an explicit stop silences', () => {
        // The regression that motivated this module: a symmetric
        // register/unregister that paused on detach fired on StrictMode's
        // double-invoked effects and on every remount, leaving the video
        // paused with its `paused` prop unchanged, so React never restored it.
        // Detaching must be silent.
        const player = makePlayer();
        setScenesPlaybackPlayer(player);

        setScenesPlaybackPlayer(null);

        expect(player.pause).not.toHaveBeenCalled();
        expect(player.setVolume).not.toHaveBeenCalled();
    });

    it('keeps playing across a detach/reattach cycle', () => {
        // Same scenario, asserted on the surviving player: remounting must not
        // interrupt playback.
        const player = makePlayer();
        setScenesPlaybackPlayer(player);
        setScenesPlaybackPlayer(null);
        setScenesPlaybackPlayer(player);

        expect(player.pause).not.toHaveBeenCalled();
    });

    it('stops the reattached player when navigation finally happens', () => {
        const player = makePlayer();
        setScenesPlaybackPlayer(player);
        setScenesPlaybackPlayer(null);
        setScenesPlaybackPlayer(player);

        stopScenesPlayback();

        expect(player.setVolume).toHaveBeenCalledWith(0);
        expect(player.pause).toHaveBeenCalled();
    });
});

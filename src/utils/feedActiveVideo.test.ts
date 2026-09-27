import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    __resetFeedActiveVideoForTests,
    getActiveFeedVideoPostId,
    getFeedTextureMountAllowed,
    haltFeedPlayback,
    registerFeedVideoPlayer,
    releaseFeedPlaybackOnBlur,
    restoreFeedPlaybackAfterFocus,
    setActiveFeedVideoPostId,
    setFeedPlaybackAllowed,
    setFeedTextureMountAllowed,
    subscribeFeedPlaybackAllowed,
} from './feedActiveVideoNative';

/**
 * `feedActiveVideoNative` is the single-player bookkeeping the whole app shares:
 * the feed, Profile's grid and the ViewProfile posts sheet all claim the one
 * ExoPlayer through `setActiveFeedVideoPostId`. It is plain module state, so
 * these tests drive it directly — no React or Reanimated needed.
 *
 * The invariant under test is "exactly one video is audible". A leak shows up in
 * production two ways: old audio keeps playing over a new screen, or the new
 * screen cannot start at all.
 */
function makePlayer() {
    return { pause: vi.fn(), setVolume: vi.fn(), resume: vi.fn() };
}

afterEach(() => {
    __resetFeedActiveVideoForTests();
    vi.restoreAllMocks();
});

describe('single-player slot', () => {
    it('halts the previous player when a different post claims the slot', () => {
        const a = makePlayer();
        const b = makePlayer();
        registerFeedVideoPlayer(a);
        registerFeedVideoPlayer(b);

        setActiveFeedVideoPostId('1');
        setActiveFeedVideoPostId('2');

        // Every registered player is stopped on the switch, not just the one
        // being replaced — a recycled card can still hold a live handle.
        expect(a.pause).toHaveBeenCalled();
        expect(b.setVolume).toHaveBeenCalledWith(0);
        expect(getActiveFeedVideoPostId()).toBe('2');
    });

    it('does not re-notify when the same post re-claims the slot', () => {
        setActiveFeedVideoPostId('5');
        const player = makePlayer();
        registerFeedVideoPlayer(player);

        setActiveFeedVideoPostId('5');

        // Tearing an already-correct player down and restarting it is what
        // produces the ColorOS "plays twice" double-audio bug.
        expect(player.pause).not.toHaveBeenCalled();
    });
});

describe('releaseFeedPlaybackOnBlur', () => {
    it('stops playback and frees the slot', () => {
        const player = makePlayer();
        registerFeedVideoPlayer(player);
        setActiveFeedVideoPostId('9');

        releaseFeedPlaybackOnBlur();

        expect(player.pause).toHaveBeenCalled();
        expect(player.setVolume).toHaveBeenCalledWith(0);
        expect(getActiveFeedVideoPostId()).toBeNull();
    });

    it('lets another screen claim the slot after the feed blurs', () => {
        // The bug this guards: closing `playbackAllowed` on blur also froze
        // every *other* screen out, because the flag is module-global and
        // setActiveFeedVideoPostId early-returns while it is false. Profile and
        // ViewProfile videos then stayed silent and the feed kept the id until
        // the user navigated all the way back to the feed.
        setFeedPlaybackAllowed(false);
        setActiveFeedVideoPostId(null);

        releaseFeedPlaybackOnBlur();
        setActiveFeedVideoPostId('profile-post');

        expect(getActiveFeedVideoPostId()).toBe('profile-post');
    });

    it('re-opens the gate so a returning profile grid can play again', () => {
        const seen: Array<boolean> = [];
        // A fresh subscriber must observe the gate as open, not inherit a
        // stale `false` from the blur that just happened.
        releaseFeedPlaybackOnBlur();
        const unsub = subscribeFeedPlaybackAllowed((allowed) => seen.push(allowed));
        unsub();

        expect(seen).toEqual([true]);
    });

    it('is idempotent, so a double blur cannot wedge the gate shut', () => {
        releaseFeedPlaybackOnBlur();
        releaseFeedPlaybackOnBlur();
        setActiveFeedVideoPostId('7');

        expect(getActiveFeedVideoPostId()).toBe('7');
    });

    it('keeps the TextureView mount gate open, per the existing blur contract', () => {
        releaseFeedPlaybackOnBlur();

        expect(getFeedTextureMountAllowed()).toBe(true);
    });

    it('holds at most one player per registrant, so slots never contend', () => {
        // Only feed cards register. The Scenes overlay deliberately does not,
        // so `haltAllPlayers()` can never pause the video the user is watching
        // in the fullscreen viewer.
        const feedCard = makePlayer();
        registerFeedVideoPlayer(feedCard);
        setActiveFeedVideoPostId('11');

        setActiveFeedVideoPostId('12');

        expect(feedCard.setVolume).toHaveBeenCalledWith(0);
    });
});

describe('setFeedTextureMountAllowed', () => {
    it('hard-stops playback when TextureViews are forbidden', () => {
        // A paused TextureView still paints into Stories 24 thumbs on ColorOS,
        // so forbidding mounts must also stop audio.
        const player = makePlayer();
        registerFeedVideoPlayer(player);
        setActiveFeedVideoPostId('3');

        setFeedTextureMountAllowed(false);

        expect(player.pause).toHaveBeenCalled();
        expect(getActiveFeedVideoPostId()).toBeNull();
    });
});

describe('restoreFeedPlaybackAfterFocus', () => {
    it('re-asserts volume after the blur-time halt so the feed returns audible', () => {
        const player = makePlayer();
        registerFeedVideoPlayer(player);
        setActiveFeedVideoPostId('7');

        // Blur: every player is imperatively silenced.
        player.pause.mockClear();
        player.setVolume.mockClear();

        // Coming back re-arms the slot, which silences again. Without an explicit
        // restore the clip is left at volume 0 and needs a second sound-icon tap.
        restoreFeedPlaybackAfterFocus(false);

        expect(player.setVolume).toHaveBeenLastCalledWith(1);
        expect(player.resume).toHaveBeenCalled();
    });

    it('restores to muted volume and does not resume while the user has sound off', () => {
        const player = makePlayer();
        registerFeedVideoPlayer(player);
        setActiveFeedVideoPostId('7');
        player.pause.mockClear();
        player.setVolume.mockClear();

        restoreFeedPlaybackAfterFocus(true);

        expect(player.setVolume).toHaveBeenLastCalledWith(0);
        expect(player.resume).not.toHaveBeenCalled();
    });

    it('is a no-op when the feed is still blurred, so a background claim cannot unmute', () => {
        const player = makePlayer();
        registerFeedVideoPlayer(player);
        setActiveFeedVideoPostId('7');

        setFeedPlaybackAllowed(false);
        player.setVolume.mockClear();
        player.resume.mockClear();

        restoreFeedPlaybackAfterFocus(false);

        expect(player.setVolume).not.toHaveBeenCalled();
        expect(player.resume).not.toHaveBeenCalled();
    });

    it('is a no-op when no card owns the slot', () => {
        const player = makePlayer();
        registerFeedVideoPlayer(player);
        player.setVolume.mockClear();

        restoreFeedPlaybackAfterFocus(false);

        expect(player.setVolume).not.toHaveBeenCalled();
    });
});

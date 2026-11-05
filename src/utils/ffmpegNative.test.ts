import { describe, expect, it } from 'vitest';
import { isAppWritableVideoPath, toFfmpegPath } from './ffmpegNative';

describe('toFfmpegPath', () => {
    it('strips file:// so ffmpeg-kit gets an absolute Android path', () => {
        expect(toFfmpegPath('file:///storage/emulated/0/DCIM/clip.mp4')).toBe(
            '/storage/emulated/0/DCIM/clip.mp4',
        );
        expect(toFfmpegPath('file:///data/user/0/com.clipsapp/cache/a%20b.mp4')).toBe(
            '/data/user/0/com.clipsapp/cache/a b.mp4',
        );
    });

    it('leaves a plain absolute path unchanged', () => {
        expect(toFfmpegPath('/data/user/0/com.clipsapp/cache/clip.mp4')).toBe(
            '/data/user/0/com.clipsapp/cache/clip.mp4',
        );
    });

    it('treats gallery folders as not writable', () => {
        expect(isAppWritableVideoPath('file:///storage/emulated/0/DCIM/clip.mp4')).toBe(false);
        expect(isAppWritableVideoPath('/data/user/0/com.clipsapp/cache/clip.mp4')).toBe(true);
    });
});

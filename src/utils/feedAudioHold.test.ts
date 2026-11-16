import { afterEach, describe, expect, it } from 'vitest';
import { holdFeedAudio, isFeedAudioHeld } from './feedAudioHold';

describe('holdFeedAudio', () => {
  const releases: Array<() => void> = [];

  afterEach(() => {
    while (releases.length) releases.pop()?.();
  });

  it('stays held until the last caller releases', () => {
    expect(isFeedAudioHeld()).toBe(false);
    releases.push(holdFeedAudio());
    expect(isFeedAudioHeld()).toBe(true);
    releases.push(holdFeedAudio());
    releases.pop()?.();
    expect(isFeedAudioHeld()).toBe(true);
    releases.pop()?.();
    expect(isFeedAudioHeld()).toBe(false);
  });

  it('ignores a second release from the same caller', () => {
    const release = holdFeedAudio();
    releases.push(release);
    release();
    release();
    expect(isFeedAudioHeld()).toBe(false);
    releases.pop();
  });
});

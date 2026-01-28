import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { timeAgo } from './timeAgo';

describe('timeAgo', () => {
  const now = 1000000000000; // fixed "now" in ms

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Just now" for timestamps within the last minute', () => {
    expect(timeAgo(now - 30 * 1000)).toBe('Just now');
    expect(timeAgo(now - 59 * 1000)).toBe('Just now');
  });

  it('returns "1 minute ago" for 1 minute ago', () => {
    expect(timeAgo(now - 60 * 1000)).toBe('1 minute ago');
  });

  it('returns "N minutes ago" for multiple minutes', () => {
    expect(timeAgo(now - 5 * 60 * 1000)).toBe('5 minutes ago');
  });

  it('returns "1 hour ago" for 1 hour ago', () => {
    expect(timeAgo(now - 60 * 60 * 1000)).toBe('1 hour ago');
  });

  it('returns "N hours ago" for multiple hours', () => {
    expect(timeAgo(now - 3 * 60 * 60 * 1000)).toBe('3 hours ago');
  });

  it('returns "1 day ago" for 1 day ago', () => {
    expect(timeAgo(now - 24 * 60 * 60 * 1000)).toBe('1 day ago');
  });

  it('returns "N days ago" for multiple days', () => {
    expect(timeAgo(now - 3 * 24 * 60 * 60 * 1000)).toBe('3 days ago');
  });

  it('returns "1 week ago" for ~1 week ago', () => {
    expect(timeAgo(now - 7 * 24 * 60 * 60 * 1000)).toBe('1 week ago');
  });

  it('returns "1 year ago" for ~1 year ago', () => {
    expect(timeAgo(now - 365 * 24 * 60 * 60 * 1000)).toBe('1 year ago');
  });
});

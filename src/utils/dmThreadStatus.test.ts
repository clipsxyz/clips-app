import { describe, expect, it } from 'vitest';
import { formatDmPresenceLabel, laravelMessageIsRead } from './dmThreadStatus';

describe('laravelMessageIsRead', () => {
    it('treats a read_at timestamp as read', () => {
        expect(laravelMessageIsRead({ read_at: '2026-10-26T15:00:00.000000Z' })).toBe(true);
        expect(laravelMessageIsRead({ readAt: '2026-10-26T15:00:00.000000Z' })).toBe(true);
        expect(laravelMessageIsRead({ read: true })).toBe(true);
    });

    it('treats missing read_at as unread', () => {
        expect(laravelMessageIsRead({ read_at: null })).toBe(false);
        expect(laravelMessageIsRead({ read: false })).toBe(false);
        expect(laravelMessageIsRead({})).toBe(false);
    });
});

describe('formatDmPresenceLabel', () => {
    const now = Date.parse('2026-10-26T15:40:00.000Z');

    it('returns Active now within the last-active touch window', () => {
        expect(formatDmPresenceLabel('2026-10-26T15:36:00.000Z', now)).toBe('Active now');
        expect(formatDmPresenceLabel(now - 4 * 60 * 1000, now)).toBe('Active now');
    });

    it('falls back to a compact last-seen label', () => {
        expect(formatDmPresenceLabel('2026-10-26T15:10:00.000Z', now)).toBe('Active 30m ago');
        expect(formatDmPresenceLabel('2026-10-26T12:40:00.000Z', now)).toBe('Active 3h ago');
        expect(formatDmPresenceLabel('2026-10-24T15:40:00.000Z', now)).toBe('Active 2d ago');
    });

    it('returns empty when last active is unknown', () => {
        expect(formatDmPresenceLabel(null, now)).toBe('');
        expect(formatDmPresenceLabel(undefined, now)).toBe('');
        expect(formatDmPresenceLabel('not-a-date', now)).toBe('');
    });
});

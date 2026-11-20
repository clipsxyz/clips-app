import { describe, expect, it } from 'vitest';
import { groupNotificationsIntoSections } from './notificationSections';

describe('groupNotificationsIntoSections', () => {
    const now = new Date(2026, 10, 20, 15, 0, 0).getTime();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const today = start.getTime();
    const day = 24 * 60 * 60 * 1000;

    it('puts unread items in New and read items into Today, This Week, and Earlier', () => {
        const sections = groupNotificationsIntoSections(
            [
                { id: 'old-unread', read: false, timestamp: today - 40 * day },
                { id: 'today-read', read: true, timestamp: today + 60 * 1000 },
                { id: 'week-read', read: true, timestamp: today - 2 * day },
                { id: 'earlier-read', read: true, timestamp: today - 8 * day },
            ],
            now,
        );

        expect(sections.map((section) => section.label)).toEqual([
            'New',
            'Today',
            'This Week',
            'Earlier',
        ]);
        expect(sections.map((section) => section.items.map((item) => item.id))).toEqual([
            ['old-unread'],
            ['today-read'],
            ['week-read'],
            ['earlier-read'],
        ]);
    });

    it('skips a section that has no notifications', () => {
        const sections = groupNotificationsIntoSections(
            [{ id: 'only-new', read: false, timestamp: today }],
            now,
        );

        expect(sections.map((section) => section.label)).toEqual(['New']);
    });
});

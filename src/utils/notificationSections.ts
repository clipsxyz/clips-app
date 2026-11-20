export type NotificationSectionId = 'new' | 'today' | 'week' | 'earlier';

export type NotificationSection<T> = {
    id: NotificationSectionId;
    label: string;
    items: T[];
};

const SECTION_ORDER: NotificationSectionId[] = ['new', 'today', 'week', 'earlier'];

const SECTION_LABEL: Record<NotificationSectionId, string> = {
    new: 'New',
    today: 'Today',
    week: 'This Week',
    earlier: 'Earlier',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(now: number): number {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    return day.getTime();
}

/** Unread items stay in New. Read items fall into Today, the rest of the last 7 days, or Earlier. */
export function notificationSectionFor(
    item: { read: boolean; timestamp: number },
    now = Date.now(),
): NotificationSectionId {
    if (!item.read) return 'new';
    const today = startOfLocalDay(now);
    if (item.timestamp >= today) return 'today';
    if (item.timestamp >= today - 6 * DAY_MS) return 'week';
    return 'earlier';
}

export function groupNotificationsIntoSections<T extends { read: boolean; timestamp: number }>(
    items: readonly T[],
    now = Date.now(),
): NotificationSection<T>[] {
    const buckets: Record<NotificationSectionId, T[]> = {
        new: [],
        today: [],
        week: [],
        earlier: [],
    };
    for (const item of items) {
        buckets[notificationSectionFor(item, now)].push(item);
    }
    return SECTION_ORDER.filter((id) => buckets[id].length > 0).map((id) => ({
        id,
        label: SECTION_LABEL[id],
        items: buckets[id],
    }));
}

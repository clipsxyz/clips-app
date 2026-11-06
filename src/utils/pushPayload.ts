export type PushPayload = {
    title: string;
    body: string;
    data: Record<string, string>;
    badge: number | null;
};

function asString(value: unknown): string {
    if (value == null) return '';
    const text = String(value).trim();
    return text;
}

/** Normalize an FCM remote message into title, body, string data, and an optional badge. */
export function extractPushPayload(message: any): PushPayload {
    const rawData = message?.data && typeof message.data === 'object' ? message.data : {};
    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawData)) {
        const text = asString(value);
        if (text) data[key] = text;
    }

    const title = asString(message?.notification?.title || data.title || data.notification_title) || 'Gazetteer';
    const body = asString(message?.notification?.body || data.body || data.message || data.notification_body);
    const badgeRaw = data.badge ?? data.badgeCount ?? data.unread ?? data.badge_count;
    const badgeNum = badgeRaw == null || badgeRaw === '' ? NaN : Number(badgeRaw);

    return {
        title,
        body,
        data,
        badge: Number.isFinite(badgeNum) ? badgeNum : null,
    };
}

/** True when a Laravel message payload has been read by the recipient. */
export function laravelMessageIsRead(m: {
    read?: boolean | number | string | null;
    read_at?: string | null;
    readAt?: string | null;
} | null | undefined): boolean {
    if (!m) return false;
    if (m.read === true || m.read === 1 || m.read === '1') return true;
    const raw = m.read_at ?? m.readAt;
    return typeof raw === 'string' ? raw.trim().length > 0 : raw != null;
}

/**
 * DM header / info-sheet presence. `last_active_at` is touched on authenticated
 * API traffic about every 5 minutes, so anything newer than that is "Active now".
 */
export function formatDmPresenceLabel(
    lastActiveAt: string | number | Date | null | undefined,
    now: number = Date.now(),
): string {
    if (lastActiveAt == null || lastActiveAt === '') return '';
    const ts =
        typeof lastActiveAt === 'number'
            ? lastActiveAt
            : lastActiveAt instanceof Date
              ? lastActiveAt.getTime()
              : Date.parse(String(lastActiveAt));
    if (!Number.isFinite(ts)) return '';
    const seconds = Math.max(0, Math.floor((now - ts) / 1000));
    if (seconds < 5 * 60) return 'Active now';
    if (seconds < 3600) {
        const minutes = Math.max(1, Math.floor(seconds / 60));
        return `Active ${minutes}m ago`;
    }
    if (seconds < 86400) {
        const hours = Math.max(1, Math.floor(seconds / 3600));
        return `Active ${hours}h ago`;
    }
    if (seconds < 604800) {
        const days = Math.max(1, Math.floor(seconds / 86400));
        return `Active ${days}d ago`;
    }
    const weeks = Math.max(1, Math.floor(seconds / 604800));
    return `Active ${weeks}w ago`;
}

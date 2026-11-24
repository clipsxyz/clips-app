export type BoostDurationHours = 6 | 12 | 24 | 72;

export function formatBoostRemaining(ms: number): string {
    if (ms <= 0) return '0m';
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

export function formatBoostWindow(hours: number): string {
    if (hours === 72) return '3d';
    if (hours >= 24 && hours % 24 === 0) return `${hours / 24}d`;
    return `${Math.max(0, hours)}h`;
}

/** 0 at the start of the window, 1 when it expires. */
export function boostTimeProgress(startsAt: number, expiresAt: number, now = Date.now()): number {
    const total = expiresAt - startsAt;
    if (total <= 0) return now >= expiresAt ? 1 : 0;
    return Math.min(1, Math.max(0, (now - startsAt) / total));
}

export function boostReachProgress(views: number, estimated: number): number {
    if (estimated <= 0) return 0;
    return Math.min(1, Math.max(0, views / estimated));
}

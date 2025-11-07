/**
 * Convert epoch timestamp to local timezone-aware display
 * Like Instagram's absolute time display: "10:30 AM EST"
 * 
 * @param timestamp - Epoch timestamp in milliseconds
 * @param options - Formatting options
 * @returns Human-readable time string in user's local timezone
 */
export function formatLocalTime(
    timestamp: number,
    options: {
        includeDate?: boolean;
        includeTimezone?: boolean;
        format?: '12h' | '24h';
    } = {}
): string {
    const {
        includeDate = false,
        includeTimezone = false,
        format = '12h'
    } = options;

    const date = new Date(timestamp); // Automatically converts to local timezone

    // Format time
    const timeOptions: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: format === '12h'
    };

    if (includeTimezone) {
        timeOptions.timeZoneName = 'short'; // e.g., "EST", "PST"
    }

    let timeString = date.toLocaleTimeString('en-US', timeOptions);

    // Format date if needed
    if (includeDate) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const isToday = date.toDateString() === today.toDateString();
        const isYesterday = date.toDateString() === yesterday.toDateString();

        if (isToday) {
            return `Today ${timeString}`;
        } else if (isYesterday) {
            return `Yesterday ${timeString}`;
        } else {
            const dateString = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
            });
            return `${dateString} ${timeString}`;
        }
    }

    return timeString;
}

/**
 * Convert epoch timestamp to ISO string (for backend/storage)
 * Always in UTC timezone
 * 
 * @param timestamp - Epoch timestamp in milliseconds
 * @returns ISO string like "2024-01-15T10:30:00.000Z"
 */
export function toISOString(timestamp: number): string {
    return new Date(timestamp).toISOString();
}

/**
 * Parse ISO string back to epoch timestamp
 * 
 * @param isoString - ISO string like "2024-01-15T10:30:00.000Z"
 * @returns Epoch timestamp in milliseconds
 */
export function fromISOString(isoString: string): number {
    return new Date(isoString).getTime();
}


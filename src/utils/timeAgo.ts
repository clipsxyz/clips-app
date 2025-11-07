/**
 * Convert epoch timestamp (milliseconds) to human-readable "time ago" format
 * Similar to Instagram's time display
 * 
 * @param timestamp - Epoch timestamp in milliseconds (from Date.now() or post.createdAt)
 * @returns Human-readable string like "2 hours ago", "3 days ago", "Just now"
 */
export function timeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp; // Difference in milliseconds

    // Convert to seconds
    const seconds = Math.floor(diff / 1000);

    // Less than 1 minute
    if (seconds < 60) {
        return 'Just now';
    }

    // Less than 1 hour
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
    }

    // Less than 1 day
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    }

    // Less than 1 week
    const days = Math.floor(hours / 24);
    if (days < 7) {
        return days === 1 ? '1 day ago' : `${days} days ago`;
    }

    // Less than 1 month
    const weeks = Math.floor(days / 7);
    if (weeks < 4) {
        return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }

    // Less than 1 year
    const months = Math.floor(days / 30);
    if (months < 12) {
        return months === 1 ? '1 month ago' : `${months} months ago`;
    }

    // Years
    const years = Math.floor(days / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
}


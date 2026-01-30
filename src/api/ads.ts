import type { Ad, AdAccount } from '../types';

/**
 * AD SYSTEM WITH EPOCH TIME TRACKING
 * 
 * Similar to Instagram/Meta Ads Manager:
 * - All events tracked with epoch timestamps (milliseconds)
 * - Budget resets at midnight in ad account timezone
 * - Ad scheduling based on timezone
 * - Attribution using epoch time differences
 */

// Mock ad accounts storage
let adAccounts: AdAccount[] = [
    {
        id: 'ad-account-1',
        name: 'Dublin Local Business',
        timezone: 'Europe/Dublin', // Irish Standard Time
        dailyBudget: 100.00,
        currency: 'EUR',
        lastBudgetReset: getMidnightInTimezone('Europe/Dublin'),
        createdAt: Date.now() - 86400000 * 30 // 30 days ago
    },
    {
        id: 'ad-account-2',
        name: 'Global Brand',
        timezone: 'America/New_York', // Eastern Time
        dailyBudget: 500.00,
        currency: 'USD',
        lastBudgetReset: getMidnightInTimezone('America/New_York'),
        createdAt: Date.now() - 86400000 * 60 // 60 days ago
    }
];

// Mock ads storage
let ads: Ad[] = [
    {
        id: 'ad-1',
        adAccountId: 'ad-account-1',
        advertiserHandle: 'LocalCafe@Dublin',
        title: 'Best Coffee in Dublin',
        description: 'Visit us for the finest coffee experience',
        mediaUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800',
        mediaType: 'image',
        callToAction: 'Visit Website',
        linkUrl: 'https://example.com',
        scheduledStart: Date.now() - 3600000, // 1 hour ago
        scheduledEnd: Date.now() + 86400000 * 7, // 7 days from now
        createdAt: Date.now() - 86400000, // 1 day ago
        dailyBudget: 50.00,
        spentToday: 12.50,
        lastBudgetReset: getMidnightInTimezone('Europe/Dublin'),
        stats: {
            impressions: 1250,
            clicks: 45,
            conversions: 8,
            spend: 12.50
        },
        events: {
            impressions: [],
            clicks: [],
            conversions: []
        },
        targetLocations: ['Dublin', 'Ireland'],
        targetTags: ['food', 'coffee'],
        isActive: true
    }
];

/**
 * Get midnight (00:00:00) in a specific timezone as epoch timestamp
 * This is critical for budget reset logic - resets at midnight in ad account timezone
 * 
 * @param timezone - IANA timezone string (e.g., "America/New_York", "Europe/Dublin")
 * @returns Epoch timestamp of midnight (00:00:00) today in that timezone
 */
export function getMidnightInTimezone(timezone: string): number {
    const now = Date.now();

    // Get current date in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const parts = formatter.formatToParts(new Date(now));
    const year = parseInt(parts.find(p => p.type === 'year')!.value);
    const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1;
    const day = parseInt(parts.find(p => p.type === 'day')!.value);

    // Create a date string for midnight in the target timezone
    // Format: YYYY-MM-DDTHH:mm:ss
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`;

    // Use Intl.DateTimeFormat to get the timezone offset
    // Create a date at midnight UTC and see what time it is in the target timezone
    const utcMidnight = new Date(`${dateStr}Z`); // Parse as UTC midnight

    // Get what time this UTC midnight represents in the target timezone
    const tzTimeStr = utcMidnight.toLocaleString('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    // Calculate the offset needed to get midnight in target timezone
    // If UTC midnight is 5:00 AM in EST, we need to subtract 5 hours
    const [tzHours, tzMinutes, tzSeconds] = tzTimeStr.split(':').map(Number);
    const offsetMs = (tzHours * 60 * 60 * 1000) + (tzMinutes * 60 * 1000) + (tzSeconds * 1000);

    // Midnight in timezone = UTC midnight - offset
    return utcMidnight.getTime() - offsetMs;
}

/**
 * Check if budget should be reset (if it's past midnight in ad account timezone)
 * This is called periodically to reset daily budgets
 * 
 * @param adAccount - Ad account with timezone
 * @returns true if budget should be reset, false otherwise
 */
export function shouldResetBudget(adAccount: AdAccount): boolean {
    const now = Date.now(); // Current epoch timestamp
    const timezone = adAccount.timezone;

    // Get current midnight in the ad account's timezone
    const currentMidnight = getMidnightInTimezone(timezone);

    // If last reset was before current midnight, we need to reset
    return adAccount.lastBudgetReset < currentMidnight;
}

/**
 * Reset daily budget for an ad account
 * Called at midnight in the ad account's timezone
 * 
 * @param adAccountId - Ad account ID
 * @returns Updated ad account with reset budget
 */
export function resetDailyBudget(adAccountId: string): AdAccount {
    const account = adAccounts.find(a => a.id === adAccountId);
    if (!account) {
        throw new Error(`Ad account not found: ${adAccountId}`);
    }

    const now = Date.now();
    const midnight = getMidnightInTimezone(account.timezone);

    // Reset all ads in this account
    ads.forEach(ad => {
        if (ad.adAccountId === adAccountId) {
            ad.spentToday = 0;
            ad.lastBudgetReset = midnight;
        }
    });

    // Update account
    account.lastBudgetReset = midnight;

    return account;
}

/**
 * Check if an ad should be shown based on scheduling and budget
 * Uses epoch timestamps for all time comparisons
 * 
 * @param ad - Ad to check
 * @returns true if ad should be shown, false otherwise
 */
export function shouldShowAd(ad: Ad): boolean {
    const now = Date.now(); // Current epoch timestamp

    // Check if ad is active
    if (!ad.isActive) return false;

    // Check scheduling (epoch timestamp comparison)
    if (ad.scheduledStart && now < ad.scheduledStart) return false;
    if (ad.scheduledEnd && now > ad.scheduledEnd) return false;

    // Check budget (reset if needed)
    const account = adAccounts.find(a => a.id === ad.adAccountId);
    if (!account) return false;

    // Reset budget if it's past midnight in ad account timezone
    if (shouldResetBudget(account)) {
        resetDailyBudget(ad.adAccountId);
    }

    // Check if daily budget is exhausted
    if (ad.spentToday >= ad.dailyBudget) return false;

    return true;
}

/**
 * Track ad impression with epoch timestamp
 * Similar to Meta Pixel tracking
 * 
 * @param adId - Ad ID
 * @param userId - User ID who saw the ad
 * @returns Updated ad with impression tracked
 */
export async function trackAdImpression(adId: string, _userId: string): Promise<Ad> {
    const ad = ads.find(a => a.id === adId);
    if (!ad) {
        throw new Error(`Ad not found: ${adId}`);
    }

    const now = Date.now(); // Epoch timestamp

    // Track impression with epoch timestamp
    ad.events.impressions.push(now);
    ad.stats.impressions += 1;

    // Calculate cost (example: $0.01 per impression)
    const costPerImpression = 0.01;
    ad.spentToday += costPerImpression;
    ad.stats.spend += costPerImpression;

    return ad;
}

/**
 * Track ad click with epoch timestamp
 * Used for attribution (click time vs conversion time)
 * 
 * @param adId - Ad ID
 * @param userId - User ID who clicked
 * @returns Updated ad with click tracked
 */
export async function trackAdClick(adId: string, _userId: string): Promise<Ad> {
    const ad = ads.find(a => a.id === adId);
    if (!ad) {
        throw new Error(`Ad not found: ${adId}`);
    }

    const now = Date.now(); // Epoch timestamp

    // Track click with epoch timestamp
    ad.events.clicks.push(now);
    ad.stats.clicks += 1;

    // Calculate cost (example: $0.50 per click)
    const costPerClick = 0.50;
    ad.spentToday += costPerClick;
    ad.stats.spend += costPerClick;

    return ad;
}

/**
 * Track ad conversion with epoch timestamp
 * Used for attribution: conversionTime - clickTime = attribution window
 * 
 * @param adId - Ad ID
 * @param userId - User ID who converted
 * @param clickTime - Epoch timestamp of when user clicked (for attribution)
 * @returns Updated ad with conversion tracked
 */
export async function trackAdConversion(
    adId: string,
    _userId: string,
    clickTime?: number
): Promise<Ad> {
    const ad = ads.find(a => a.id === adId);
    if (!ad) {
        throw new Error(`Ad not found: ${adId}`);
    }

    const now = Date.now(); // Epoch timestamp (conversion time)

    // Track conversion with epoch timestamp
    ad.events.conversions.push(now);
    ad.stats.conversions += 1;

    // Attribution: calculate time between click and conversion
    if (clickTime) {
        const attributionWindow = now - clickTime; // Time difference in milliseconds
        const attributionWindowHours = attributionWindow / (1000 * 60 * 60);
        console.log(`Attribution: ${attributionWindowHours.toFixed(2)} hours between click and conversion`);
    }

    return ad;
}

/**
 * Get active ads that should be shown in feed
 * Filters by scheduling, budget, and targeting
 * 
 * @param userLocation - User's location for targeting
 * @param userTags - User's interests/tags for targeting
 * @returns Array of ads that should be shown
 */
export async function getActiveAds(
    userLocation?: string,
    userTags?: string[]
): Promise<Ad[]> {
    const now = Date.now(); // Current epoch timestamp

    // Reset budgets for all accounts if needed
    adAccounts.forEach(account => {
        if (shouldResetBudget(account)) {
            resetDailyBudget(account.id);
        }
    });

    // Filter ads
    const activeAds = ads.filter(ad => {
        // Check if ad should be shown
        if (!shouldShowAd(ad)) return false;

        // Targeting: location
        if (ad.targetLocations && ad.targetLocations.length > 0) {
            if (!userLocation || !ad.targetLocations.some(loc =>
                userLocation.toLowerCase().includes(loc.toLowerCase())
            )) {
                return false;
            }
        }

        // Targeting: tags
        if (ad.targetTags && ad.targetTags.length > 0) {
            if (!userTags || !ad.targetTags.some(tag =>
                userTags.includes(tag.toLowerCase())
            )) {
                return false;
            }
        }

        return true;
    });

    // Sort by creation time (newest first) using epoch timestamps
    return activeAds.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get ad account by ID
 */
export async function getAdAccount(adAccountId: string): Promise<AdAccount | null> {
    return adAccounts.find(a => a.id === adAccountId) || null;
}

/**
 * Create a new ad
 */
export async function createAd(
    adAccountId: string,
    advertiserHandle: string,
    title: string,
    mediaUrl: string,
    mediaType: 'image' | 'video',
    dailyBudget: number,
    timezone: string,
    options?: {
        description?: string;
        callToAction?: string;
        linkUrl?: string;
        scheduledStart?: number; // Epoch timestamp
        scheduledEnd?: number; // Epoch timestamp
        targetLocations?: string[];
        targetTags?: string[];
    }
): Promise<Ad> {
    const now = Date.now(); // Epoch timestamp
    const midnight = getMidnightInTimezone(timezone);

    const newAd: Ad = {
        id: `ad-${crypto.randomUUID()}`,
        adAccountId,
        advertiserHandle,
        title,
        description: options?.description,
        mediaUrl,
        mediaType,
        callToAction: options?.callToAction,
        linkUrl: options?.linkUrl,
        scheduledStart: options?.scheduledStart,
        scheduledEnd: options?.scheduledEnd,
        createdAt: now, // Epoch timestamp
        dailyBudget,
        spentToday: 0,
        lastBudgetReset: midnight, // Epoch timestamp of midnight in timezone
        stats: {
            impressions: 0,
            clicks: 0,
            conversions: 0,
            spend: 0
        },
        events: {
            impressions: [],
            clicks: [],
            conversions: []
        },
        targetLocations: options?.targetLocations,
        targetTags: options?.targetTags,
        isActive: true
    };

    ads.push(newAd);
    return newAd;
}

/**
 * Get attribution data for an ad
 * Shows time between click and conversion using epoch timestamps
 */
export function getAdAttribution(adId: string): {
    clickToConversionTimes: number[]; // Array of time differences in milliseconds
    averageAttributionWindow: number; // Average time in milliseconds
} {
    const ad = ads.find(a => a.id === adId);
    if (!ad) {
        throw new Error(`Ad not found: ${adId}`);
    }

    const clickToConversionTimes: number[] = [];

    // Match clicks to conversions (within 24 hour window)
    const attributionWindow = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    ad.events.clicks.forEach(clickTime => {
        // Find conversions within attribution window
        const conversions = ad.events.conversions.filter(convTime => {
            const timeDiff = convTime - clickTime;
            return timeDiff > 0 && timeDiff <= attributionWindow;
        });

        conversions.forEach(convTime => {
            const timeDiff = convTime - clickTime; // Time difference in milliseconds
            clickToConversionTimes.push(timeDiff);
        });
    });

    const averageAttributionWindow = clickToConversionTimes.length > 0
        ? clickToConversionTimes.reduce((a, b) => a + b, 0) / clickToConversionTimes.length
        : 0;

    return {
        clickToConversionTimes,
        averageAttributionWindow
    };
}


// Share analytics tracking system
export interface ShareAnalytics {
  postId: string;
  platform: string;
  timestamp: number;
  userId?: string;
  userAgent: string;
  referrer: string;
}

class ShareAnalyticsService {
  private analytics: ShareAnalytics[] = [];

  // Track a share event
  trackShare(postId: string, platform: string, userId?: string): void {
    const shareEvent: ShareAnalytics = {
      postId,
      platform,
      timestamp: Date.now(),
      userId,
      userAgent: navigator.userAgent,
      referrer: document.referrer
    };

    // Store locally
    this.analytics.push(shareEvent);
    this.saveToLocalStorage();

    // Send to analytics service (if available)
    this.sendToAnalytics(shareEvent);

    console.log(`📊 Share tracked: ${platform} for post ${postId}`);
  }

  // Get share statistics for a post
  getPostShareStats(postId: string): { platform: string; count: number }[] {
    const postShares = this.analytics.filter(share => share.postId === postId);
    const platformCounts: { [key: string]: number } = {};

    postShares.forEach(share => {
      platformCounts[share.platform] = (platformCounts[share.platform] || 0) + 1;
    });

    return Object.entries(platformCounts).map(([platform, count]) => ({
      platform,
      count
    }));
  }

  // Get total shares for a post
  getTotalShares(postId: string): number {
    return this.analytics.filter(share => share.postId === postId).length;
  }

  // Get most shared platforms
  getTopPlatforms(): { platform: string; count: number }[] {
    const platformCounts: { [key: string]: number } = {};

    this.analytics.forEach(share => {
      platformCounts[share.platform] = (platformCounts[share.platform] || 0) + 1;
    });

    return Object.entries(platformCounts)
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count);
  }

  // Save analytics to localStorage
  private saveToLocalStorage(): void {
    try {
      localStorage.setItem('shareAnalytics', JSON.stringify(this.analytics));
    } catch (error) {
      console.error('Failed to save share analytics:', error);
    }
  }

  // Load analytics from localStorage
  loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem('shareAnalytics');
      if (stored) {
        this.analytics = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load share analytics:', error);
    }
  }

  // Send to external analytics service
  private async sendToAnalytics(shareEvent: ShareAnalytics): Promise<void> {
    try {
      // This would integrate with your analytics service (Google Analytics, Mixpanel, etc.)
      // For now, we'll just log it
      console.log('📈 Analytics event:', shareEvent);
      
      // Example: Send to Google Analytics
      // gtag('event', 'share', {
      //   method: shareEvent.platform,
      //   content_type: 'post',
      //   item_id: shareEvent.postId
      // });
    } catch (error) {
      console.error('Failed to send analytics:', error);
    }
  }

  // Clear old analytics (older than 30 days)
  cleanupOldAnalytics(): void {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.analytics = this.analytics.filter(share => share.timestamp > thirtyDaysAgo);
    this.saveToLocalStorage();
  }
}

// Export singleton instance
export const shareAnalytics = new ShareAnalyticsService();

// Initialize analytics service
shareAnalytics.loadFromLocalStorage();
shareAnalytics.cleanupOldAnalytics();



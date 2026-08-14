export type FeedUiMode = 'compact' | 'comfortable';

/**
 * Aspect values are height/width (Instagram feed policy), matching web Media in App.tsx:
 * FEED_MIN_ASPECT = 3/4, FEED_TARGET_ASPECT = 5/4 (4:5 portrait max).
 *
 * Icon/type sizes match mobile web (App.tsx BottomNav + feed engagement):
 * - tab icons 16px in 28px squares (w-7 h-7)
 * - engagement actions w-6 h-6 → 24
 * - avatar sm w-8 h-8 → 32
 * - Stories header 32 / Passport w-8 h-8 → 32
 */
const FEED_UI_BY_MODE = {
  compact: {
    media: {
      minAspect: 3 / 4,
      maxAspect: 5 / 4,
    },
    spacing: {
      inset: 12,
      compactV: 8,
      normalV: 12,
      cardGap: 8,
      groupGap: 12,
      groupGapTight: 10,
      hairlineGap: 0.5,
    },
    type: {
      actionCount: 12,
      /** Feed PostHeader username — denser than web `text-sm`. */
      handle: 12,
      /** Web metadata carousel `text-[10px]`. */
      meta: 10,
      /** Web metadata icon `w-3 h-3`. */
      metaIcon: 12,
      reclip: 11,
      caption: 14,
      captionMore: 12,
    },
    icon: {
      /** Web EngagementBar `w-6 h-6` (24). Use 20 so RN SVG stroke weight matches Fi visual size. */
      action: 20,
      /** Matches smaller feed handle (~12px). */
      flag: 11,
      /** Web avatar `w-8 h-8` (32); 28 reads closer on dense phone feed. */
      avatar: 28,
      tab: 16,
      tabSquare: 28,
      headerStories: 32,
      headerLocation: 16,
      headerPassport: 32,
    },
  },
  comfortable: {
    media: {
      minAspect: 3 / 4,
      maxAspect: 5 / 4,
    },
    spacing: {
      inset: 14,
      compactV: 10,
      normalV: 12,
      cardGap: 12,
      groupGap: 14,
      groupGapTight: 12,
      hairlineGap: 1,
    },
    type: {
      actionCount: 12,
      handle: 12,
      meta: 10,
      metaIcon: 12,
      reclip: 11,
      caption: 14,
      captionMore: 12,
    },
    icon: {
      action: 20,
      flag: 11,
      avatar: 28,
      tab: 16,
      tabSquare: 28,
      headerStories: 32,
      headerLocation: 16,
      headerPassport: 32,
    },
  },
} as const;

// Switch this to 'comfortable' if you want a roomier layout.
export const FEED_UI_MODE: FeedUiMode = 'compact';
export const FEED_UI = FEED_UI_BY_MODE[FEED_UI_MODE];

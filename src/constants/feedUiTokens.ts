import { ox, NATIVE_OPTICAL_SCALE } from './nativeOpticalScale';

export type FeedUiMode = 'compact' | 'comfortable';

/**
 * Aspect values are height/width (Instagram feed policy), matching web Media in App.tsx:
 * FEED_MIN_ASPECT = 3/4, FEED_TARGET_ASPECT = 5/4 (4:5 portrait max).
 *
 * Optical scale: on same physical phone size, RN density-independent px usually reads
 * smaller than mobile Safari/Chrome CSS px. Bump feed chrome so Nokia RN matches Oppo web.
 */
export const FEED_OPTICAL_SCALE = NATIVE_OPTICAL_SCALE;

const FEED_UI_BY_MODE = {
  compact: {
    media: {
      minAspect: 3 / 4,
      maxAspect: 5 / 4,
    },
    spacing: {
      inset: ox(12),
      compactV: ox(8),
      normalV: ox(12),
      cardGap: ox(8),
      groupGap: ox(12),
      groupGapTight: ox(10),
      hairlineGap: 0.5,
    },
    type: {
      actionCount: ox(12),
      // Web text-sm ≈ 14 CSS px — optically larger on RN phones.
      handle: ox(16),
      meta: ox(12),
      metaIcon: ox(14),
      reclip: ox(13),
      caption: ox(14),
      captionMore: ox(12),
    },
    icon: {
      // Web engagement icons ≈ 24 CSS px.
      action: ox(28),
      flag: ox(18),
      avatar: ox(36),
      tab: ox(22),
      tabSquare: ox(36),
      headerStories: ox(36),
      headerLocation: ox(20),
      headerPassport: ox(36),
    },
  },
  comfortable: {
    media: {
      minAspect: 3 / 4,
      maxAspect: 5 / 4,
    },
    spacing: {
      inset: ox(14),
      compactV: ox(10),
      normalV: ox(12),
      cardGap: ox(12),
      groupGap: ox(14),
      groupGapTight: ox(12),
      hairlineGap: 1,
    },
    type: {
      actionCount: ox(13),
      handle: ox(16),
      meta: ox(12),
      metaIcon: ox(14),
      reclip: ox(13),
      caption: ox(14),
      captionMore: ox(12),
    },
    icon: {
      action: ox(28),
      flag: ox(18),
      avatar: ox(36),
      tab: ox(22),
      tabSquare: ox(36),
      headerStories: ox(36),
      headerLocation: ox(20),
      headerPassport: ox(36),
    },
  },
} as const;

// Switch this to 'comfortable' if you want a roomier layout.
export const FEED_UI_MODE: FeedUiMode = 'compact';
export const FEED_UI = FEED_UI_BY_MODE[FEED_UI_MODE];

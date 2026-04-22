export type FeedUiMode = 'compact' | 'comfortable';

const FEED_UI_BY_MODE = {
  compact: {
    media: {
      minAspect: 3 / 4,
      maxAspect: 4 / 5,
    },
    spacing: {
      inset: 12,
      compactV: 8,
      normalV: 10,
      cardGap: 8,
      groupGap: 12,
      groupGapTight: 10,
      hairlineGap: 0.5,
    },
    type: {
      actionCount: 12,
    },
    icon: {
      action: 20,
    },
  },
  comfortable: {
    media: {
      minAspect: 3 / 4,
      maxAspect: 4 / 5,
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
      actionCount: 13,
    },
    icon: {
      action: 20,
    },
  },
} as const;

// Switch this to 'comfortable' if you want a roomier layout.
export const FEED_UI_MODE: FeedUiMode = 'compact';
export const FEED_UI = FEED_UI_BY_MODE[FEED_UI_MODE];


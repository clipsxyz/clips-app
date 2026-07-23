export type FeedUiMode = 'compact' | 'comfortable';

/**
 * Aspect values are height/width (Instagram feed policy), matching web Media in App.tsx:
 * FEED_MIN_ASPECT = 3/4, FEED_TARGET_ASPECT = 5/4 (4:5 portrait max).
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
      // Optical bump vs web text-sm / text-[10px] — Instagram weight on phone screens.
      handle: 16,
      meta: 12,
      metaIcon: 14,
      reclip: 13,
    },
    icon: {
      // Optical bump vs web 24px CSS — Instagram weight on smaller/denser phone screens.
      action: 28,
      flag: 18,
      // Web Avatar size="sm" is 32 — bumped for phone Instagram weight.
      avatar: 36,
      // Header / tab chrome (optical bump vs web 16-in-28 squares).
      tab: 22,
      tabSquare: 36,
      headerStories: 36,
      headerLocation: 20,
      headerPassport: 36,
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
      actionCount: 13,
      handle: 16,
      meta: 12,
      metaIcon: 14,
      reclip: 13,
    },
    icon: {
      action: 28,
      flag: 18,
      avatar: 36,
      tab: 22,
      tabSquare: 36,
      headerStories: 36,
      headerLocation: 20,
      headerPassport: 36,
    },
  },
} as const;

// Switch this to 'comfortable' if you want a roomier layout.
export const FEED_UI_MODE: FeedUiMode = 'compact';
export const FEED_UI = FEED_UI_BY_MODE[FEED_UI_MODE];


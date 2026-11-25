/**
 * Feed text-card type scale. Short lines stay large; longer posts step down
 * so they still fit a 4:5 canvas. Canvas pickers are unchanged.
 */
export function feedTextCardType(text: string): { fontSize: number; maxLines: number } {
    const len = text.trim().length;
    if (len <= 32) return { fontSize: 40, maxLines: 4 };
    if (len <= 90) return { fontSize: 30, maxLines: 7 };
    if (len <= 180) return { fontSize: 24, maxLines: 9 };
    if (len <= 320) return { fontSize: 20, maxLines: 11 };
    return { fontSize: 17, maxLines: 13 };
}

/** Lively display face. iOS Avenir Next, Android condensed sans, web the same stack. */
export const FEED_TEXT_CARD_FONT_NATIVE = {
    ios: 'AvenirNext-DemiBold',
    android: 'sans-serif-condensed',
    default: 'sans-serif',
} as const;

export const FEED_TEXT_CARD_FONT_WEB =
    '"Avenir Next Demi Bold", "Avenir Next", "Century Gothic", "Trebuchet MS", sans-serif';

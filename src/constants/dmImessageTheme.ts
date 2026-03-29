/**
 * iMessage-inspired dark palette for Gazetteer DMs (approximates iOS Messages dark mode).
 * Sent: system blue (iMessage) or green (SMS-style); received: secondary gray bubble.
 */
export const DM_SENT_BG = 'bg-[#0A84FF]';
/** iOS Messages green — classic SMS / outgoing green bubble */
export const DM_SENT_GREEN_BG = 'bg-[#34C759]';
export const DM_RECEIVED_BG = 'bg-[#3A3A3C]';
/** Composer strip: true black (grayscale chrome). */
export const DM_INPUT_BAR = 'bg-black';
/** Inset field on black bar — barely lifted for readability */
export const DM_INPUT_FIELD = 'bg-zinc-950';

const STORAGE_SENT_BUBBLE = 'gazetteer-dm-sent-bubble';

export type DmSentBubbleStyle = 'blue' | 'green';

export function getDmSentBubblePreference(): DmSentBubbleStyle {
  if (typeof window === 'undefined') return 'blue';
  const v = localStorage.getItem(STORAGE_SENT_BUBBLE);
  return v === 'green' ? 'green' : 'blue';
}

export function setDmSentBubblePreference(style: DmSentBubbleStyle): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_SENT_BUBBLE, style);
}

export function dmSentBubbleBgClass(style: DmSentBubbleStyle): string {
  return style === 'green' ? DM_SENT_GREEN_BG : DM_SENT_BG;
}

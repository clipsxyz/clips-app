/** Resolve signup / profile country flag text to emoji or ISO2 for the Flag component. */

const NATIONAL_TO_FLAG: Record<string, string> = {
  ireland: '🇮🇪',
  'northern ireland': '🇬🇧',
  uk: '🇬🇧',
  'united kingdom': '🇬🇧',
  usa: '🇺🇸',
  'united states': '🇺🇸',
  brazil: '🇧🇷',
  france: '🇫🇷',
  germany: '🇩🇪',
  spain: '🇪🇸',
  italy: '🇮🇹',
  portugal: '🇵🇹',
  netherlands: '🇳🇱',
  belgium: '🇧🇪',
  canada: '🇨🇦',
  australia: '🇦🇺',
  'new zealand': '🇳🇿',
  india: '🇮🇳',
  japan: '🇯🇵',
  china: '🇨🇳',
  mexico: '🇲🇽',
  argentina: '🇦🇷',
};

const ALIAS_TO_ISO2: Record<string, string> = {
  ire: 'IE',
  irl: 'IE',
  ie: 'IE',
  uk: 'GB',
  gbr: 'GB',
  gb: 'GB',
  us: 'US',
  usa: 'US',
};

function hasFlagEmoji(s: string): boolean {
  return /[\u{1F1E6}-\u{1F1FF}]{2}/u.test(s);
}

export function flagEmojiForNational(national: string): string {
  const key = national.trim().toLowerCase();
  if (!key) return '';
  return NATIONAL_TO_FLAG[key] || '';
}

/** Normalize stored flag field before save (prefer emoji, infer from national). */
export function normalizeCountryFlagInput(flagInput: string, national: string): string {
  const raw = flagInput.trim();
  if (hasFlagEmoji(raw)) return raw;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const alias = ALIAS_TO_ISO2[raw.toLowerCase()];
  if (alias) return alias;
  const fromNational = flagEmojiForNational(national);
  if (fromNational) return fromNational;
  const fromName = flagEmojiForNational(raw);
  if (fromName) return fromName;
  return '';
}

/** Value passed to Flag component (emoji or ISO2). */
export function resolveCountryFlagDisplay(value: string | undefined | null, national?: string): string {
  const v = (value || '').trim();
  if (!v && national) return normalizeCountryFlagInput('', national);
  return normalizeCountryFlagInput(v, national || '');
}

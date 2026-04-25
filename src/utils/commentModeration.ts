export type CommentModerationLevel = 'none' | 'warn' | 'hide';

export type CommentModerationResult = {
  level: CommentModerationLevel;
  matched: string[];
};

export type CommentModerationPreferences = {
  strictMode: boolean;
  customHiddenWords: string[];
};

const PREFS_KEY = 'clips_comment_moderation_prefs_v1';

const DEFAULT_PREFS: CommentModerationPreferences = {
  strictMode: false,
  customHiddenWords: [],
};

let inMemoryPrefs: CommentModerationPreferences = { ...DEFAULT_PREFS };

const WARN_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'insult', regex: /\b(idiot|moron|loser|dumb|stupid|ugly|pathetic|trash)\b/i },
  { label: 'aggressive phrase', regex: /\b(shut up|get lost|nobody asked)\b/i },
];

const HIDE_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'threat', regex: /\b(kill yourself|i will kill you|die\b)\b/i },
  { label: 'abusive profanity', regex: /\b(fuck you|f\*+k you|bitch|b\*+tch)\b/i },
];

export function getCommentModerationPreferences(): CommentModerationPreferences {
  const hasLocalStorage = typeof localStorage !== 'undefined';
  if (!hasLocalStorage) {
    return { ...inMemoryPrefs };
  }
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return {
      strictMode: Boolean(parsed?.strictMode),
      customHiddenWords: Array.isArray(parsed?.customHiddenWords)
        ? parsed.customHiddenWords
            .map((w: unknown) => String(w || '').trim().toLowerCase())
            .filter((w: string) => w.length > 0)
        : [],
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function setCommentModerationPreferences(next: CommentModerationPreferences): void {
  const normalized: CommentModerationPreferences = {
    strictMode: Boolean(next?.strictMode),
    customHiddenWords: Array.from(
      new Set(
        (Array.isArray(next?.customHiddenWords) ? next.customHiddenWords : [])
          .map((w) => String(w || '').trim().toLowerCase())
          .filter((w) => w.length > 0)
      )
    ),
  };
  inMemoryPrefs = { ...normalized };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PREFS_KEY, JSON.stringify(normalized));
  }
}

export function evaluateCommentModeration(
  text: string,
  prefs: CommentModerationPreferences = getCommentModerationPreferences()
): CommentModerationResult {
  const input = String(text || '').trim();
  if (!input) return { level: 'none', matched: [] };

  const hideMatches = HIDE_PATTERNS.filter((p) => p.regex.test(input)).map((p) => p.label);
  const customWordMatches = (prefs.customHiddenWords || []).filter((word) => word.length > 0 && input.toLowerCase().includes(word));
  if (customWordMatches.length > 0) {
    return { level: 'hide', matched: customWordMatches.map((word) => `custom:${word}`) };
  }
  if (hideMatches.length > 0) {
    return { level: 'hide', matched: hideMatches };
  }

  const warnMatches = WARN_PATTERNS.filter((p) => p.regex.test(input)).map((p) => p.label);
  if (prefs.strictMode && warnMatches.length > 0) {
    return { level: 'hide', matched: warnMatches };
  }
  if (warnMatches.length > 0) {
    return { level: 'warn', matched: warnMatches };
  }

  return { level: 'none', matched: [] };
}


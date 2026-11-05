export type CommentModerationLevel = 'none' | 'warn' | 'hide';

export type CommentModerationResult = {
  level: CommentModerationLevel;
  matched: string[];
};

export type CommentAudience = 'everyone' | 'followers' | 'nobody';

export type CommentModerationPreferences = {
  strictMode: boolean;
  customHiddenWords: string[];
  allowComments: boolean;
  commentAudience: CommentAudience;
};

const PREFS_KEY = 'clips_comment_moderation_prefs_v1';

const DEFAULT_PREFS: CommentModerationPreferences = {
  strictMode: false,
  customHiddenWords: [],
  allowComments: true,
  commentAudience: 'everyone',
};

function normalizeAudience(value: unknown, allowComments: boolean): CommentAudience {
  if (!allowComments) return 'nobody';
  if (value === 'followers' || value === 'nobody' || value === 'everyone') return value;
  return 'everyone';
}

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
    const allowComments = parsed?.allowComments === undefined ? true : Boolean(parsed.allowComments);
    return {
      strictMode: Boolean(parsed?.strictMode),
      customHiddenWords: Array.isArray(parsed?.customHiddenWords)
        ? parsed.customHiddenWords
            .map((w: unknown) => String(w || '').trim().toLowerCase())
            .filter((w: string) => w.length > 0)
        : [],
      allowComments,
      commentAudience: normalizeAudience(parsed?.commentAudience, allowComments),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function setCommentModerationPreferences(next: CommentModerationPreferences): void {
  const allowComments = next?.allowComments === undefined ? true : Boolean(next.allowComments);
  const normalized: CommentModerationPreferences = {
    strictMode: Boolean(next?.strictMode),
    customHiddenWords: Array.from(
      new Set(
        (Array.isArray(next?.customHiddenWords) ? next.customHiddenWords : [])
          .map((w) => String(w || '').trim().toLowerCase())
          .filter((w) => w.length > 0)
      )
    ),
    allowComments,
    commentAudience: normalizeAudience(next?.commentAudience, allowComments),
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

export function applyRemoteCommentControls(user: {
  allow_comments?: boolean;
  comment_audience?: string;
} | null | undefined): void {
  if (!user || (user.allow_comments === undefined && user.comment_audience === undefined)) return;
  const allow = user.allow_comments !== false && user.comment_audience !== 'nobody';
  const audience = normalizeAudience(user.comment_audience, allow);
  const current = getCommentModerationPreferences();
  setCommentModerationPreferences({
    ...current,
    allowComments: allow,
    commentAudience: audience,
  });
}

export function resolveCommentComposerAccess(
  post: {
    userHandle?: string;
    user_id?: string;
    userId?: string;
    isFollowing?: boolean;
    allowComments?: boolean;
    allow_comments?: boolean;
    commentAudience?: string;
    comment_audience?: string;
  } | null | undefined,
  viewer?: { id?: string; handle?: string } | null,
): { canComment: boolean; message: string } {
  if (!post) return { canComment: true, message: '' };

  const viewerHandle = String(viewer?.handle || '').replace(/^@/, '').trim().toLowerCase();
  const authorHandle = String(post.userHandle || '').replace(/^@/, '').trim().toLowerCase();
  const isAuthor = Boolean(
    (viewerHandle && authorHandle && viewerHandle === authorHandle) ||
      (viewer?.id && (post.user_id || post.userId) && viewer.id === (post.user_id || post.userId)),
  );

  let allow = post.allowComments ?? post.allow_comments;
  let audience = String(post.commentAudience || post.comment_audience || 'everyone');
  if (isAuthor) {
    const prefs = getCommentModerationPreferences();
    allow = prefs.allowComments;
    audience = prefs.commentAudience;
  }

  if (allow === false || audience === 'nobody') {
    return { canComment: false, message: 'Comments are turned off' };
  }
  if (audience === 'followers' && !isAuthor && !post.isFollowing) {
    return { canComment: false, message: 'Only followers can comment' };
  }
  return { canComment: true, message: '' };
}


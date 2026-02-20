const STABLE_UID_KEY = 'clips_app_stable_uid';

/** Stable userId for feed/follow state so we never flip between anon and real id (avoids follow state "not sticking"). Always returns a string so profile and feed use the same storage key. */
export function getStableUserId(user: { id?: string | number } | null): string {
  if (user?.id != null) {
    const idStr = String(user.id);
    try {
      localStorage.setItem(STABLE_UID_KEY, idStr);
    } catch (_) {}
    return idStr;
  }
  try {
    const stored = localStorage.getItem(STABLE_UID_KEY);
    if (stored) return stored;
  } catch (_) {}
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u?.id != null) return String(u.id);
    }
  } catch (_) {}
  return 'anon';
}

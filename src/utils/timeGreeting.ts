export type DayPart = 'morning' | 'afternoon' | 'evening';

/** Morning 5:00–11:59, afternoon 12:00–17:00, evening 17:01–04:59. */
export function getDayPart(date: Date = new Date()): DayPart {
  const mins = date.getHours() * 60 + date.getMinutes();
  if (mins >= 5 * 60 && mins < 12 * 60) return 'morning';
  if (mins >= 12 * 60 && mins <= 17 * 60) return 'afternoon';
  return 'evening';
}

export function getTimeGreeting(date: Date = new Date()): string {
  const part = getDayPart(date);
  if (part === 'morning') return 'Good morning';
  if (part === 'afternoon') return 'Good afternoon';
  return 'Good evening';
}

/** e.g. "Good evening, Alex" or "Good evening, Welcome". */
export function getSplashGreetingLine(userName?: string | null): string {
  const greeting = getTimeGreeting();
  const first = userName?.trim().split(/\s+/)[0];
  if (first) return `${greeting}, ${first}`;
  return `${greeting}, Welcome`;
}

/** Travel / lifestyle backdrops by time of day (remote — web CSS / browsers). */
export const SPLASH_BACKDROP_BY_DAY_PART: Record<DayPart, string> = {
  morning:
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80&auto=format&fit=crop',
  afternoon:
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&q=80&auto=format&fit=crop',
  evening:
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600&q=80&auto=format&fit=crop',
};

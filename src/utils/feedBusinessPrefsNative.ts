import AsyncStorage from '@react-native-async-storage/async-storage';

export const BUSINESS_SUGGESTION_LAST_SHOWN_KEY = 'clips:businessSuggestionLastShown';
export const BUSINESS_HIDDEN_KEY = 'clips:hiddenBusinessSuggestions';
export const BUSINESS_LIKED_KEY = 'clips:likedBusinessSuggestions';
export const BUSINESS_STRIP_LAST_INSERTED_KEY = 'clips:businessStripLastInsertedAt';
export const BUSINESS_STRIP_MIN_INTERVAL_MS = 8 * 60 * 1000;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function loadBusinessLastShown(): Promise<Record<string, number>> {
  return readJson(BUSINESS_SUGGESTION_LAST_SHOWN_KEY, {});
}

export async function loadHiddenBusinesses(): Promise<Set<string>> {
  const arr = await readJson<string[]>(BUSINESS_HIDDEN_KEY, []);
  return new Set(arr.map((s) => String(s).trim().toLowerCase()).filter(Boolean));
}

export async function loadLikedBusinesses(): Promise<Set<string>> {
  const arr = await readJson<string[]>(BUSINESS_LIKED_KEY, []);
  return new Set(arr.map((s) => String(s).trim().toLowerCase()).filter(Boolean));
}

export async function loadBusinessStripEligible(): Promise<boolean> {
  try {
    const last = Number((await AsyncStorage.getItem(BUSINESS_STRIP_LAST_INSERTED_KEY)) || '0');
    return Date.now() - last >= BUSINESS_STRIP_MIN_INTERVAL_MS;
  } catch {
    return true;
  }
}

export async function markBusinessSuggestionShown(businessKey: string): Promise<void> {
  if (!businessKey) return;
  const current = await loadBusinessLastShown();
  current[businessKey] = Date.now();
  await AsyncStorage.setItem(BUSINESS_SUGGESTION_LAST_SHOWN_KEY, JSON.stringify(current));
}

export async function hideBusinessSuggestion(businessKey: string): Promise<void> {
  if (!businessKey) return;
  const current = await readJson<string[]>(BUSINESS_HIDDEN_KEY, []);
  const key = businessKey.trim().toLowerCase();
  const next = [...new Set([...current, key])].slice(0, 100);
  await AsyncStorage.setItem(BUSINESS_HIDDEN_KEY, JSON.stringify(next));
}

export async function unhideBusinessSuggestion(businessKey: string): Promise<void> {
  if (!businessKey) return;
  const current = await readJson<string[]>(BUSINESS_HIDDEN_KEY, []);
  const key = businessKey.trim().toLowerCase();
  const next = current.filter((k) => String(k).trim().toLowerCase() !== key);
  await AsyncStorage.setItem(BUSINESS_HIDDEN_KEY, JSON.stringify(next));
}

export async function likeBusinessSuggestion(businessKey: string): Promise<void> {
  if (!businessKey) return;
  const current = await readJson<string[]>(BUSINESS_LIKED_KEY, []);
  const key = businessKey.trim().toLowerCase();
  const next = [...new Set([...current, key])].slice(0, 100);
  await AsyncStorage.setItem(BUSINESS_LIKED_KEY, JSON.stringify(next));
}

export async function markBusinessStripInserted(): Promise<void> {
  await AsyncStorage.setItem(BUSINESS_STRIP_LAST_INSERTED_KEY, String(Date.now()));
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SuggestedPlacesPrefs } from './feedStreamInjection';

const DISMISS_ALL_KEY = 'clips:suggestedPlacesDismissAll';
const DISMISSED_BUNDLES_KEY = 'clips:suggestedPlacesDismissedBundles';
const INCLUDE_POSTER_LOCALE_KEY = 'clips:suggestedPlacesIncludePosterLocale';

export async function loadSuggestedPlacesPrefs(): Promise<SuggestedPlacesPrefs> {
  try {
    const dismissAll = (await AsyncStorage.getItem(DISMISS_ALL_KEY)) === '1';
    const raw = await AsyncStorage.getItem(DISMISSED_BUNDLES_KEY);
    const dismissedBundles = raw ? (JSON.parse(raw) as string[]) : [];
    const includePosterLocale = (await AsyncStorage.getItem(INCLUDE_POSTER_LOCALE_KEY)) === '1';
    return { dismissAll, dismissedBundles, includePosterLocale };
  } catch {
    return { dismissAll: false, dismissedBundles: [], includePosterLocale: false };
  }
}

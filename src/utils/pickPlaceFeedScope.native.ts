import { Alert } from 'react-native';
import type { LocationSuggestion } from '../api/locations';
import {
    getPlaceFeedPickerOptions,
    resolvePlaceFeedSelection,
    type PlaceFeedSelection,
} from './pickPlaceFeedScope';

export type { PlaceFeedSelection };

export function pickPlaceFeedScopeNative(
    suggestion: LocationSuggestion,
    onPick: (selection: PlaceFeedSelection) => void
): void {
    const picker = getPlaceFeedPickerOptions(suggestion);
    if (!picker) {
        onPick(resolvePlaceFeedSelection(suggestion));
        return;
    }

    Alert.alert(
        'Which feed?',
        picker.fullName,
        [
            ...picker.options.map((opt) => ({
                text: opt.label,
                onPress: () => onPick(resolvePlaceFeedSelection(suggestion, opt.scope)),
            })),
            { text: 'Cancel', style: 'cancel' as const },
        ],
        { cancelable: true }
    );
}

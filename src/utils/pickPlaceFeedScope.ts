import type { LocationSuggestion } from '../api/locations';
import {
    feedFilterForScope,
    feedHeaderLabelFromSuggestion,
    parsedPlaceFeedFromSuggestion,
    type FeedScope,
    type ParsedPlaceFeed,
} from './placeFeedLevels';

export type PlaceFeedSelection = {
    filter: string;
    scope: FeedScope;
    label: string;
    fullName: string;
};

export function resolvePlaceFeedSelection(
    suggestion: LocationSuggestion,
    scope?: FeedScope
): PlaceFeedSelection {
    const parsed = parsedPlaceFeedFromSuggestion(suggestion);
    const headerLabel = feedHeaderLabelFromSuggestion(suggestion, parsed);
    if (suggestion.type === 'venue' || suggestion.type === 'landmark') {
        return {
            filter: parsed.fullName,
            scope: 'local',
            label: headerLabel,
            fullName: parsed.fullName,
        };
    }
    const chosenScope = scope || parsed.defaultScope;
    const filter = feedFilterForScope(parsed, chosenScope);
    return {
        filter,
        scope: chosenScope,
        label: headerLabel,
        fullName: parsed.fullName,
    };
}

/** Returns options when UI should show a picker; null when selection is automatic. */
export function getPlaceFeedPickerOptions(suggestion: LocationSuggestion): ParsedPlaceFeed | null {
    if (suggestion.type === 'venue' || suggestion.type === 'landmark') {
        return null;
    }
    const parsed = parsedPlaceFeedFromSuggestion(suggestion);
    return parsed.options.length > 1 ? parsed : null;
}

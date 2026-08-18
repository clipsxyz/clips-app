import type { LocationSuggestion } from '../api/locations';
import { geocodeLocation } from '../api/locations';
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
    placeId?: string | null;
};

/**
 * Warm Laravel/Google geocode cache when the user picks a place (fire-and-forget).
 */
export function warmPlaceGeocode(suggestion: LocationSuggestion | PlaceFeedSelection): void {
    const placeId =
        'place_id' in suggestion
            ? suggestion.place_id
            : 'placeId' in suggestion
              ? suggestion.placeId
              : null;
    const q =
        'name' in suggestion
            ? suggestion.name
            : 'fullName' in suggestion
              ? suggestion.fullName
              : 'label' in suggestion
                ? suggestion.label
                : '';
    void geocodeLocation({ placeId: placeId ?? null, q: q || null });
}

export function resolvePlaceFeedSelection(
    suggestion: LocationSuggestion,
    scope?: FeedScope
): PlaceFeedSelection {
    const parsed = parsedPlaceFeedFromSuggestion(suggestion);
    const headerLabel = feedHeaderLabelFromSuggestion(suggestion, parsed);
    const placeId = suggestion.place_id ?? null;
    warmPlaceGeocode(suggestion);
    if (suggestion.type === 'venue' || suggestion.type === 'landmark') {
        // Feed filter must match post.venue / post.landmark tags (usually a short name),
        // not the full Google "Name, City, Country" description.
        const primary =
            primaryPlaceTag(headerLabel) ||
            primaryPlaceTag(cleanPart(suggestion.display_name)) ||
            primaryPlaceTag(parsed.fullName) ||
            headerLabel;
        return {
            filter: primary,
            scope: 'local',
            label: headerLabel || primary,
            fullName: parsed.fullName || primary,
            placeId,
        };
    }
    const chosenScope = scope || parsed.defaultScope;
    const filter = feedFilterForScope(parsed, chosenScope);
    return {
        filter,
        scope: chosenScope,
        label: headerLabel,
        fullName: parsed.fullName,
        placeId,
    };
}

/** First segment of a Places description — used as venue/landmark feed tag. */
export function primaryPlaceTag(raw: string): string {
    const venueSuffixRe =
        /\s+(railway station|train station|bus station|metro station|airport|international airport|station)$/i;
    let base = String(raw || '')
        .split(',')[0]
        .trim();
    base = base.replace(venueSuffixRe, '').trim();
    return base;
}

function cleanPart(value: string | undefined | null): string {
    return String(value || '').trim();
}

/** Returns options when UI should show a picker; null when selection is automatic. */
export function getPlaceFeedPickerOptions(suggestion: LocationSuggestion): ParsedPlaceFeed | null {
    if (suggestion.type === 'venue' || suggestion.type === 'landmark') {
        return null;
    }
    const parsed = parsedPlaceFeedFromSuggestion(suggestion);
    return parsed.options.length > 1 ? parsed : null;
}

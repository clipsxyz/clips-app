import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocationSuggestion } from '../api/locations';
import { geocodeLocation } from '../api/locations';

vi.mock('../api/locations', () => ({
    geocodeLocation: vi.fn(() => Promise.resolve(null)),
}));

import {
    getPlaceFeedPickerOptions,
    primaryPlaceTag,
    resolvePlaceFeedSelection,
} from './pickPlaceFeedScope';

const parisFrance: LocationSuggestion = {
    name: 'Paris, France',
    type: 'city',
    country: 'France',
    national: 'France',
    display_name: 'Paris, France',
};

describe('resolvePlaceFeedSelection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('treats a venue as a local feed and warms the geocode cache', () => {
        const venue: LocationSuggestion = {
            name: 'Dublin Airport',
            type: 'venue',
            national: 'Ireland',
            display_name: 'Dublin Airport, Dublin, Ireland',
            place_id: 'venue-place-1',
        };

        const selection = resolvePlaceFeedSelection(venue);

        expect(selection.scope).toBe('local');
        expect(selection.filter).toBe('Dublin');
        expect(selection.label).toBe('Dublin');
        expect(selection.fullName).toBe('Dublin Airport');
        expect(selection.placeId).toBe('venue-place-1');
        expect(geocodeLocation).toHaveBeenCalledWith({
            placeId: 'venue-place-1',
            q: 'Dublin Airport',
        });
    });

    it('strips station suffixes when deriving the venue feed tag', () => {
        const landmark: LocationSuggestion = {
            name: 'Heuston Station',
            type: 'landmark',
            regional: 'Dublin',
            national: 'Ireland',
            display_name: 'Heuston Railway Station, Dublin, Ireland',
        };

        const selection = resolvePlaceFeedSelection(landmark);

        expect(selection.scope).toBe('local');
        expect(selection.filter).toBe('Heuston');
        expect(selection.label).toBe('Heuston');
    });

    it('uses the suggestion default scope for locations', () => {
        const selection = resolvePlaceFeedSelection(parisFrance);

        expect(selection.scope).toBe('regional');
        expect(selection.filter).toBe('Paris');
        expect(selection.fullName).toBe('Paris, France');
    });

    it('honours an explicit scope override', () => {
        const selection = resolvePlaceFeedSelection(parisFrance, 'national');

        expect(selection.scope).toBe('national');
        expect(selection.filter).toBe('France');
    });
});

describe('primaryPlaceTag', () => {
    it('returns the first segment of a description', () => {
        expect(primaryPlaceTag('Paris, France')).toBe('Paris');
    });

    it('strips venue and station suffixes', () => {
        expect(primaryPlaceTag('Connolly Train Station, Dublin')).toBe('Connolly');
        expect(primaryPlaceTag('Shannon International Airport, Ireland')).toBe('Shannon');
    });

    it('leaves plain names untouched', () => {
        expect(primaryPlaceTag('Temple Bar')).toBe('Temple Bar');
        expect(primaryPlaceTag('')).toBe('');
    });
});

describe('getPlaceFeedPickerOptions', () => {
    it('returns null for venues and landmarks', () => {
        expect(
            getPlaceFeedPickerOptions({
                name: 'Dublin Airport',
                type: 'venue',
                display_name: 'Dublin Airport, Dublin, Ireland',
            })
        ).toBeNull();
        expect(
            getPlaceFeedPickerOptions({
                name: 'Heuston Station',
                type: 'landmark',
                display_name: 'Heuston Railway Station',
            })
        ).toBeNull();
    });

    it('returns the parsed feed when more than one scope is available', () => {
        const options = getPlaceFeedPickerOptions(parisFrance);

        expect(options).not.toBeNull();
        expect(options?.options.map((o) => o.scope)).toEqual(['national', 'regional']);
    });

    it('returns null when the selection is automatic (single scope)', () => {
        const country: LocationSuggestion = {
            name: 'Ireland',
            type: 'country',
            country: 'Ireland',
            national: 'Ireland',
        };
        expect(getPlaceFeedPickerOptions(country)).toBeNull();
    });
});
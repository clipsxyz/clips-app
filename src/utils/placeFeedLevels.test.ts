import { describe, expect, it } from 'vitest';
import type { LocationSuggestion } from '../api/locations';
import {
    feedFilterForScope,
    feedHeaderLabelFromSuggestion,
    formatFeedLevelsLine,
    parsedPlaceFeedFromSuggestion,
    scopeLabel,
    signupFeedTierRows,
} from './placeFeedLevels';

const countryIreland: LocationSuggestion = {
    name: 'Ireland',
    type: 'country',
    country: 'Ireland',
    national: 'Ireland',
    display_name: 'Ireland',
};

const parisFrance: LocationSuggestion = {
    name: 'Paris, France',
    type: 'city',
    country: 'France',
    national: 'France',
    display_name: 'Paris, France',
};

const phibsborough: LocationSuggestion = {
    name: 'Phibsborough, Dublin, Ireland',
    type: 'city',
    regional: 'Dublin',
    national: 'Ireland',
    display_name: 'Phibsborough, Dublin, Ireland',
};

describe('parsedPlaceFeedFromSuggestion', () => {
    it('defaults a country-only suggestion to the national scope', () => {
        const parsed = parsedPlaceFeedFromSuggestion(countryIreland);
        expect(parsed.defaultScope).toBe('national');
        expect(parsed.displayName).toBe('Ireland');
        expect(parsed.national).toBe('Ireland');
        expect(parsed.options).toEqual([
            { scope: 'national', label: 'Country · Ireland', filter: 'Ireland' },
        ]);
    });

    it('parses a city, country pair as a regional default with two options', () => {
        const parsed = parsedPlaceFeedFromSuggestion(parisFrance);
        expect(parsed.defaultScope).toBe('regional');
        expect(parsed.displayName).toBe('Paris');
        expect(parsed.local).toBe('Paris');
        expect(parsed.regional).toBe('Paris');
        expect(parsed.options).toEqual([
            { scope: 'national', label: 'Country · France', filter: 'France' },
            { scope: 'regional', label: 'City · Paris', filter: 'Paris' },
        ]);
    });

    it('parses a city, region, country triple with all three scopes', () => {
        const parsed = parsedPlaceFeedFromSuggestion(phibsborough);
        expect(parsed.defaultScope).toBe('local');
        expect(parsed.displayName).toBe('Phibsborough');
        expect(parsed.local).toBe('Phibsborough');
        expect(parsed.regional).toBe('Dublin');
        expect(parsed.national).toBe('Ireland');
        expect(parsed.options).toEqual([
            { scope: 'national', label: 'Country · Ireland', filter: 'Ireland' },
            { scope: 'regional', label: 'Region · Dublin', filter: 'Dublin' },
            { scope: 'local', label: 'City · Phibsborough', filter: 'Phibsborough' },
        ]);
    });

    it('drops local option when it duplicates the city', () => {
        const parsed = parsedPlaceFeedFromSuggestion({
            ...parisFrance,
            local: 'Paris',
        });
        const scopes = parsed.options.map((o) => o.scope);
        expect(scopes).toEqual(['national', 'regional']);
    });
});

describe('feedFilterForScope', () => {
    it('returns the filter for the requested scope', () => {
        const parsed = parsedPlaceFeedFromSuggestion(phibsborough);
        expect(feedFilterForScope(parsed, 'national')).toBe('Ireland');
        expect(feedFilterForScope(parsed, 'regional')).toBe('Dublin');
        expect(feedFilterForScope(parsed, 'local')).toBe('Phibsborough');
    });

    it('falls back to displayName when the scope is unavailable', () => {
        const parsed = parsedPlaceFeedFromSuggestion(parisFrance);
        expect(feedFilterForScope(parsed, 'local')).toBe('Paris');
    });
});

describe('formatFeedLevelsLine', () => {
    it('builds a plain-language summary for a city, country', () => {
        expect(formatFeedLevelsLine(parisFrance)).toBe('Country: France · City: Paris');
    });

    it('builds a summary for a city, region, country', () => {
        expect(formatFeedLevelsLine(phibsborough)).toBe(
            'Country: Ireland · City: Dublin · Local area: Phibsborough'
        );
    });

    it('is a one-liner for a country', () => {
        expect(formatFeedLevelsLine(countryIreland)).toBe('Country: Ireland');
    });
});

describe('signupFeedTierRows', () => {
    it('dedupes a local area that equals the city', () => {
        expect(signupFeedTierRows('Dublin', 'Dublin', 'Ireland')).toEqual([
            { label: 'Country', value: 'Ireland' },
            { label: 'City', value: 'Dublin' },
        ]);
    });

    it('keeps all three distinct tiers', () => {
        expect(signupFeedTierRows('Clontarf', 'Dublin', 'Ireland')).toEqual([
            { label: 'Country', value: 'Ireland' },
            { label: 'City', value: 'Dublin' },
            { label: 'Local area', value: 'Clontarf' },
        ]);
    });

    it('ignores blank tiers', () => {
        expect(signupFeedTierRows('', 'Dublin', 'Ireland')).toEqual([
            { label: 'Country', value: 'Ireland' },
            { label: 'City', value: 'Dublin' },
        ]);
        expect(signupFeedTierRows('', '', '')).toEqual([]);
    });
});

describe('scopeLabel', () => {
    it('maps scopes to display labels', () => {
        expect(scopeLabel('local')).toBe('Local');
        expect(scopeLabel('regional')).toBe('Regional');
        expect(scopeLabel('national')).toBe('National');
    });
});

describe('feedHeaderLabelFromSuggestion', () => {
    it('strips a venue suffix from the header', () => {
        const venue: LocationSuggestion = {
            name: 'Connolly Railway Station',
            type: 'venue',
            national: 'Ireland',
            display_name: 'Connolly Railway Station, Dublin, Ireland',
        };
        expect(feedHeaderLabelFromSuggestion(venue)).toBe('Connolly');
    });

    it('shortens long names to their last two words', () => {
        const museum: LocationSuggestion = {
            name: 'International Museum of Modern Digital Art',
            type: 'city',
            display_name: 'International Museum of Modern Digital Art, Dublin',
        };
        expect(feedHeaderLabelFromSuggestion(museum)).toBe('Digital Art');
    });

    it('ellipsizes an over-long single word', () => {
        const longWord: LocationSuggestion = {
            name: 'Supercalifragilisticexpialidocioushighway',
            type: 'city',
            display_name: 'Supercalifragilisticexpialidocioushighway',
        };
        expect(feedHeaderLabelFromSuggestion(longWord)).toBe('Supercalifragilisti…');
    });
});
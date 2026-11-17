import { describe, expect, it } from 'vitest';
import { profileShareDisplayName, profileShareHandleFromText } from './profileShareStory';

describe('profileShareHandleFromText', () => {
    it('reads the handle from a profile share caption', () => {
        expect(profileShareHandleFromText("Check out @Gazetteer@Dublin's profile!")).toBe('Gazetteer@Dublin');
    });

    it('ignores ordinary story text', () => {
        expect(profileShareHandleFromText('Check out this place')).toBeNull();
        expect(profileShareHandleFromText('')).toBeNull();
    });
});

describe('profileShareDisplayName', () => {
    it('uses the name before the place', () => {
        expect(profileShareDisplayName('Gazetteer@Dublin')).toBe('Gazetteer');
    });
});

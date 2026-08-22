import { describe, expect, it } from 'vitest';
import {
    buildGazetteerHandle,
    nameFromHandle,
    regionalFromHandle,
} from './gazetteerHandle';

describe('gazetteer handle Name@Place', () => {
    it('treats the part before @ as a name, even when that name is a city or country', () => {
        expect(nameFromHandle('Paris@Cork')).toBe('Paris');
        expect(regionalFromHandle('Paris@Cork')).toBe('Cork');

        expect(nameFromHandle('Ireland@Dublin')).toBe('Ireland');
        expect(regionalFromHandle('Ireland@Dublin')).toBe('Dublin');

        expect(nameFromHandle('dublin@cork')).toBe('dublin');
        expect(regionalFromHandle('dublin@cork')).toBe('cork');
    });

    it('builds handles as name@place, not place@name', () => {
        expect(buildGazetteerHandle('Paris', 'Cork')).toBe('Paris@Cork');
        expect(buildGazetteerHandle('Ireland', 'Dublin')).toBe('Ireland@Dublin');
    });
});

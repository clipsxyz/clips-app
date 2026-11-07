import { describe, expect, it } from 'vitest';
import { userFromProfileCache } from './userProfileCache';

describe('userFromProfileCache', () => {
    it('keeps the avatar and name from a raw profile payload', () => {
        const user = userFromProfileCache({
            id: 'user-1',
            display_name: 'Barry',
            handle: 'Barry@Galway',
            avatar_url: 'https://cdn.example/avatar.jpg',
            location_local: 'Galway',
        });

        expect(user?.name).toBe('Barry');
        expect(user?.avatarUrl).toBe('https://cdn.example/avatar.jpg');
        expect(user?.local).toBe('Galway');
    });

    it('ignores a blank avatar so a later merge can keep the saved photo', () => {
        const user = userFromProfileCache({
            id: 'user-1',
            name: 'Barry',
            handle: 'Barry@Galway',
            avatar_url: '   ',
        });

        expect(user?.avatarUrl).toBeUndefined();
    });
});

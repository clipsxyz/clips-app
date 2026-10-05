import { describe, expect, it } from 'vitest';
import { postMatchesLocationTab } from '../api/posts';
import {
    filterPostsForLocationFeed,
    findLocationFeedLeaks,
    isLocationScopedFeedTab,
} from './locationFeedGuard';
import type { Post } from '../types';

function post(partial: Partial<Post> & Pick<Post, 'id'>): Post {
    return {
        userHandle: 'You@Finglas',
        locationLabel: 'Finglas, Dublin',
        tags: [],
        createdAt: Date.now(),
        stats: { likes: 0, views: 0, comments: 0, shares: 0, reclips: 0 },
        userLocal: 'Finglas',
        userRegional: 'Dublin',
        userNational: 'Ireland',
        ...partial,
    } as Post;
}

const finglasVideo = post({
    id: 'own-finglas-video',
    mediaType: 'video',
    mediaUrl: 'file:///video.mp4',
});

const berlinAuthor = post({
    id: 'berlin-local',
    userHandle: 'Hans@Berlin',
    locationLabel: 'Mitte, Berlin',
    userLocal: 'Mitte',
    userRegional: 'Berlin',
    userNational: 'Germany',
});

const romeAuthor = post({
    id: 'rome-local',
    userHandle: 'Giulia@Rome',
    locationLabel: 'Trastevere, Rome',
    userLocal: 'Trastevere',
    userRegional: 'Rome',
    userNational: 'Italy',
});

describe('location core: postMatchesLocationTab', () => {
    it('keeps a Finglas author on home tiers only', () => {
        expect(postMatchesLocationTab(finglasVideo, 'finglas')).toBe(true);
        expect(postMatchesLocationTab(finglasVideo, 'dublin')).toBe(true);
        expect(postMatchesLocationTab(finglasVideo, 'ireland')).toBe(true);
    });

    it('never places a Finglas author on Rome / Berlin / Germany / Italy', () => {
        for (const tab of ['rome', 'berlin', 'germany', 'italy', 'munich', 'paris', 'london']) {
            expect(postMatchesLocationTab(finglasVideo, tab), tab).toBe(false);
        }
    });

    it('does not match via loose locationLabel substring', () => {
        const tricky = post({
            id: 'label-trap',
            locationLabel: 'From me · shared around Europe',
            userLocal: 'Finglas',
            userRegional: 'Dublin',
            userNational: 'Ireland',
        });
        expect(postMatchesLocationTab(tricky, 'rome')).toBe(false);
        expect(postMatchesLocationTab(tricky, 'berlin')).toBe(false);
    });

    it('matches Berlin / Rome authors on their own city feeds', () => {
        expect(postMatchesLocationTab(berlinAuthor, 'berlin')).toBe(true);
        expect(postMatchesLocationTab(berlinAuthor, 'germany')).toBe(true);
        expect(postMatchesLocationTab(berlinAuthor, 'rome')).toBe(false);
        expect(postMatchesLocationTab(romeAuthor, 'rome')).toBe(true);
        expect(postMatchesLocationTab(romeAuthor, 'italy')).toBe(true);
        expect(postMatchesLocationTab(romeAuthor, 'berlin')).toBe(false);
    });

    it('rejects short venue queries that would otherwise match everything', () => {
        const withVenue = post({ id: 'v1', venue: 'Park' } as Partial<Post> & { id: string; venue?: string });
        expect(postMatchesLocationTab(withVenue as Post, 'venue:a')).toBe(false);
        expect(postMatchesLocationTab(withVenue as Post, 'venue:park')).toBe(true);
    });
});

describe('national scope resolves sub-locations', () => {
    // Regression: Barry@Galway's Galway posts were returned by the Ireland feed but
    // vanished client-side. The feed payload shipped no author location tiers, so
    // postMatchesLocationTab saw '' for every tier and returned false — while Following,
    // which skips the guard, kept working. Populating the tiers (backend toApiArray) is
    // the fix; these lock the rule the payload now has to satisfy.
    const galwayAuthor = post({
        id: 'barry-galway',
        userHandle: 'Barry@Galway',
        locationLabel: 'Galway',
        userLocal: 'Oranmore',
        userRegional: 'Galway',
        userNational: 'Ireland',
    });

    const corkAuthor = post({
        id: 'cork-author',
        userHandle: 'Ava@Cork',
        locationLabel: 'Cork City',
        userLocal: 'Cork City',
        userRegional: 'Cork',
        userNational: 'Ireland',
    });

    const englishAuthor = post({
        id: 'english-author',
        userHandle: 'Barry@London',
        locationLabel: 'London, UK',
        userLocal: 'London',
        userRegional: 'England',
        userNational: 'United Kingdom',
    });

    it('keeps Galway and Cork authors on the Ireland feed', () => {
        expect(postMatchesLocationTab(galwayAuthor, 'ireland')).toBe(true);
        expect(postMatchesLocationTab(corkAuthor, 'ireland')).toBe(true);
        expect(filterPostsForLocationFeed([galwayAuthor, corkAuthor], 'ireland')).toHaveLength(2);
        expect(findLocationFeedLeaks([galwayAuthor, corkAuthor], 'ireland')).toEqual([]);
    });

    it('does not pull non-Ireland authors onto the Ireland feed', () => {
        expect(postMatchesLocationTab(englishAuthor, 'ireland')).toBe(false);
    });

    it('still scopes a Galway author to its own city feed', () => {
        expect(postMatchesLocationTab(galwayAuthor, 'galway')).toBe(true);
        expect(postMatchesLocationTab(galwayAuthor, 'cork')).toBe(false);
    });

    it('accepts a post tagged with the country even when the author sits abroad', () => {
        const taggedAbroad = post({
            id: 'tagged-abroad',
            userHandle: 'Traveller@Dubai',
            locationLabel: 'Ireland',
            userLocal: 'Dubai',
            userRegional: 'Dubai',
            userNational: 'United Arab Emirates',
        });
        expect(postMatchesLocationTab(taggedAbroad, 'ireland')).toBe(true);
    });

    it('drops live posts whose author tiers never arrived', () => {
        // Documents why the payload fix is load-bearing: with no tiers the guard
        // rejects everything, which is what emptied the Ireland feed.
        const noTiers = post({
            id: 'no-tiers',
            userHandle: 'Barry@Galway',
            locationLabel: 'Galway',
            userLocal: undefined,
            userRegional: undefined,
            userNational: undefined,
        });
        expect(postMatchesLocationTab(noTiers, 'ireland')).toBe(false);
    });
});

describe('locationFeedGuard', () => {
    it('treats place feeds as location-scoped and Following as not', () => {
        expect(isLocationScopedFeedTab('rome')).toBe(true);
        expect(isLocationScopedFeedTab('Berlin')).toBe(true);
        expect(isLocationScopedFeedTab('finglas')).toBe(true);
        expect(isLocationScopedFeedTab('discover')).toBe(false);
        expect(isLocationScopedFeedTab('following')).toBe(false);
    });

    it('strips Finglas posts out of Rome/Berlin feed payloads', () => {
        const mixed = [finglasVideo, berlinAuthor, romeAuthor];
        expect(filterPostsForLocationFeed(mixed, 'rome').map((p) => p.id)).toEqual(['rome-local']);
        expect(filterPostsForLocationFeed(mixed, 'berlin').map((p) => p.id)).toEqual(['berlin-local']);
        expect(findLocationFeedLeaks(mixed, 'rome')).toEqual(['own-finglas-video', 'berlin-local']);
        expect(findLocationFeedLeaks(mixed, 'berlin')).toEqual(['own-finglas-video', 'rome-local']);
    });

    it('keeps Finglas posts on Dublin/Ireland feeds', () => {
        expect(filterPostsForLocationFeed([finglasVideo], 'dublin')).toHaveLength(1);
        expect(filterPostsForLocationFeed([finglasVideo], 'ireland')).toHaveLength(1);
        expect(findLocationFeedLeaks([finglasVideo], 'dublin')).toEqual([]);
    });
});

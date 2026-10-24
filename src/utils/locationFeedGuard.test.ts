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
        locationLabel: 'Finglas, Dublin, Ireland',
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

const berlinPost = post({
    id: 'berlin-local',
    userHandle: 'Hans@Berlin',
    locationLabel: 'Mitte, Berlin, Germany',
    userLocal: 'Mitte',
    userRegional: 'Berlin',
    userNational: 'Germany',
});

const romePost = post({
    id: 'rome-local',
    userHandle: 'Giulia@Rome',
    locationLabel: 'Trastevere, Rome, Italy',
    userLocal: 'Trastevere',
    userRegional: 'Rome',
    userNational: 'Italy',
});

const galwayPost = post({
    id: 'barry-galway',
    userHandle: 'Barry@Galway',
    locationLabel: 'Galway, Ireland',
    userLocal: 'Oranmore',
    userRegional: 'Galway',
    userNational: 'Ireland',
});

const corkPost = post({
    id: 'cork-author',
    userHandle: 'Ava@Cork',
    locationLabel: 'Cork City, Ireland',
    userLocal: 'Cork City',
    userRegional: 'Cork',
    userNational: 'Ireland',
});

const manchesterPost = post({
    id: 'manchester-local',
    userHandle: 'Sam@Manchester',
    locationLabel: 'Northern Quarter, Manchester, UK',
    userLocal: 'Manchester',
    userRegional: 'England',
    userNational: 'United Kingdom',
});

describe('location core: postMatchesLocationTab', () => {
    it('keeps a Finglas-tagged post on home place feeds only', () => {
        expect(postMatchesLocationTab(finglasVideo, 'finglas')).toBe(true);
        expect(postMatchesLocationTab(finglasVideo, 'dublin')).toBe(true);
        expect(postMatchesLocationTab(finglasVideo, 'ireland')).toBe(true);
    });

    it('never places a Finglas-tagged post on Rome / Berlin / Germany / Italy', () => {
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

    it('matches Berlin / Rome posts on their own city feeds via the author profile', () => {
        expect(postMatchesLocationTab(berlinPost, 'berlin')).toBe(true);
        expect(postMatchesLocationTab(berlinPost, 'germany')).toBe(true);
        expect(postMatchesLocationTab(berlinPost, 'rome')).toBe(false);
        expect(postMatchesLocationTab(romePost, 'rome')).toBe(true);
        expect(postMatchesLocationTab(romePost, 'italy')).toBe(true);
        expect(postMatchesLocationTab(romePost, 'berlin')).toBe(false);
    });

    it('rejects short venue queries that would otherwise match everything', () => {
        const withVenue = post({ id: 'v1', venue: 'Park' } as Partial<Post> & { id: string; venue?: string });
        expect(postMatchesLocationTab(withVenue as Post, 'venue:a')).toBe(false);
        expect(postMatchesLocationTab(withVenue as Post, 'venue:park')).toBe(true);
    });

    it('uses author home city and ignores a foreign post tag', () => {
        const dublinAuthorGalwayTag = post({
            id: 'dublin-author-galway-tag',
            userHandle: 'Debs@Dublin',
            locationLabel: 'Eyre Square, Galway',
            userLocal: 'Ringsend',
            userRegional: 'Dublin',
            userNational: 'Ireland',
        });
        expect(postMatchesLocationTab(dublinAuthorGalwayTag, 'dublin')).toBe(true);
        expect(postMatchesLocationTab(dublinAuthorGalwayTag, 'galway')).toBe(false);
        expect(postMatchesLocationTab(dublinAuthorGalwayTag, 'manchester')).toBe(false);
    });

    it('keeps Barry@Galway out of Spain even with a Spanish venue tag', () => {
        const barryInSpain = post({
            id: 'barry-spain-venue',
            userHandle: 'Barry@Galway',
            locationLabel: 'Madrid, Spain',
            venue: 'Plaza Mayor',
            userLocal: 'Oranmore',
            userRegional: 'Galway',
            userNational: 'Ireland',
        } as Partial<Post> & { id: string; venue?: string });
        expect(postMatchesLocationTab(barryInSpain, 'spain')).toBe(false);
        expect(postMatchesLocationTab(barryInSpain, 'galway')).toBe(true);
        expect(postMatchesLocationTab(barryInSpain, 'ireland')).toBe(true);
        expect(filterPostsForLocationFeed([barryInSpain as Post], 'spain')).toHaveLength(0);
    });
});

describe('national scope resolves sub-locations from the author profile', () => {
    const englishPost = post({
        id: 'english-author',
        userHandle: 'Barry@London',
        locationLabel: 'London, UK',
        userLocal: 'London',
        userRegional: 'England',
        userNational: 'United Kingdom',
    });

    it('keeps Galway and Cork authors on the Ireland feed', () => {
        expect(postMatchesLocationTab(galwayPost, 'ireland')).toBe(true);
        expect(postMatchesLocationTab(corkPost, 'ireland')).toBe(true);
        expect(filterPostsForLocationFeed([galwayPost, corkPost], 'ireland')).toHaveLength(2);
        expect(findLocationFeedLeaks([galwayPost, corkPost], 'ireland')).toEqual([]);
    });

    it('does not pull non-Ireland tags onto the Ireland feed', () => {
        expect(postMatchesLocationTab(englishPost, 'ireland')).toBe(false);
    });

    it('still scopes a Galway author to its own city feed and not Dublin or Cork', () => {
        expect(postMatchesLocationTab(galwayPost, 'galway')).toBe(true);
        expect(postMatchesLocationTab(galwayPost, 'cork')).toBe(false);
        expect(postMatchesLocationTab(galwayPost, 'dublin')).toBe(false);
    });

    it('rejects a post tagged with the country when the author sits abroad', () => {
        const taggedAbroad = post({
            id: 'tagged-abroad',
            userHandle: 'Traveller@Dubai',
            locationLabel: 'Ireland',
            userLocal: 'Dubai',
            userRegional: 'Dubai',
            userNational: 'United Arab Emirates',
        });
        expect(postMatchesLocationTab(taggedAbroad, 'ireland')).toBe(false);
    });

    it('rolls author city profiles up to their country and never across cities', () => {
        const galwayOnly = post({
            id: 'galway-only',
            userHandle: 'Barry@Galway',
            locationLabel: 'Madrid',
            userLocal: 'Galway',
            userRegional: 'Galway',
            userNational: 'Ireland',
        });
        const madridOnly = post({
            id: 'madrid-only',
            userHandle: 'Ana@Madrid',
            locationLabel: 'Dublin',
            userLocal: 'Madrid',
            userRegional: 'Madrid',
            userNational: 'Spain',
        });
        expect(postMatchesLocationTab(galwayOnly, 'ireland')).toBe(true);
        expect(postMatchesLocationTab(galwayOnly, 'galway')).toBe(true);
        expect(postMatchesLocationTab(galwayOnly, 'dublin')).toBe(false);
        expect(postMatchesLocationTab(galwayOnly, 'spain')).toBe(false);
        expect(postMatchesLocationTab(madridOnly, 'spain')).toBe(true);
        expect(postMatchesLocationTab(madridOnly, 'ireland')).toBe(false);
        expect(postMatchesLocationTab(madridOnly, 'dublin')).toBe(false);
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
        const mixed = [finglasVideo, berlinPost, romePost];
        expect(filterPostsForLocationFeed(mixed, 'rome').map((p) => p.id)).toEqual(['rome-local']);
        expect(filterPostsForLocationFeed(mixed, 'berlin').map((p) => p.id)).toEqual(['berlin-local']);
        expect(findLocationFeedLeaks(mixed, 'rome')).toEqual(['own-finglas-video', 'berlin-local']);
        expect(findLocationFeedLeaks(mixed, 'berlin')).toEqual(['own-finglas-video', 'rome-local']);
    });

    it('keeps Finglas-tagged posts on Dublin/Ireland feeds', () => {
        expect(filterPostsForLocationFeed([finglasVideo], 'dublin')).toHaveLength(1);
        expect(filterPostsForLocationFeed([finglasVideo], 'ireland')).toHaveLength(1);
        expect(findLocationFeedLeaks([finglasVideo], 'dublin')).toEqual([]);
    });

    it('blocks Galway and Manchester tags from the Dublin feed', () => {
        const mixed = [finglasVideo, galwayPost, manchesterPost];
        expect(filterPostsForLocationFeed(mixed, 'dublin').map((p) => p.id)).toEqual(['own-finglas-video']);
        expect(filterPostsForLocationFeed(mixed, 'galway').map((p) => p.id)).toEqual(['barry-galway']);
        expect(filterPostsForLocationFeed(mixed, 'manchester').map((p) => p.id)).toEqual(['manchester-local']);
        expect(findLocationFeedLeaks(mixed, 'dublin')).toEqual(['barry-galway', 'manchester-local']);
        expect(findLocationFeedLeaks(mixed, 'galway')).toEqual(['own-finglas-video', 'manchester-local']);
        expect(findLocationFeedLeaks(mixed, 'manchester')).toEqual(['own-finglas-video', 'barry-galway']);
    });
});

import { describe, expect, it } from 'vitest';
import { postMatchesLocationTab, transformLaravelPost } from '../api/posts';
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

    it('keeps a Cork author on Ireland news but not Dublin', () => {
        const corkAuthor = post({
            id: 'cork-local',
            userHandle: 'paris@cork',
            locationLabel: 'Cork',
            userLocal: 'Cork',
            userRegional: 'Cork',
            userNational: 'Ireland',
        });
        expect(postMatchesLocationTab(corkAuthor, 'ireland')).toBe(true);
        expect(postMatchesLocationTab(corkAuthor, 'cork')).toBe(true);
        expect(postMatchesLocationTab(corkAuthor, 'dublin')).toBe(false);
        expect(postMatchesLocationTab(corkAuthor, 'paris')).toBe(false);
        expect(filterPostsForLocationFeed([corkAuthor], 'ireland')).toHaveLength(1);
    });

    it('keeps a Cork author on Ireland even when national is blank', () => {
        const corkOnly = post({
            id: 'cork-blank-national',
            userHandle: 'paris@cork',
            locationLabel: 'Cork',
            userLocal: 'Cork',
            userRegional: 'Cork',
            userNational: '',
        });
        expect(postMatchesLocationTab(corkOnly, 'ireland')).toBe(true);
        expect(postMatchesLocationTab(corkOnly, 'dublin')).toBe(false);
    });

    it('keeps a New York State author on USA news even when national is blank', () => {
        const nyOnly = post({
            id: 'ny-blank-national',
            userHandle: 'Donny@NewYorkState',
            locationLabel: 'New York State',
            userLocal: 'New York State',
            userRegional: 'New York State',
            userNational: '',
        });
        expect(postMatchesLocationTab(nyOnly, 'usa')).toBe(true);
        expect(postMatchesLocationTab(nyOnly, 'USA')).toBe(true);
        expect(postMatchesLocationTab(nyOnly, 'new york state')).toBe(true);
        expect(postMatchesLocationTab(nyOnly, 'dublin')).toBe(false);
        expect(filterPostsForLocationFeed([nyOnly], 'USA')).toHaveLength(1);
        expect(filterPostsForLocationFeed([nyOnly], 'dublin')).toHaveLength(0);
    });

    it('infers USA from Donny@NewYorkState when the API omits user locations', () => {
        const donny = transformLaravelPost({
            id: 'donny-ny-handle',
            user_handle: 'Donny@NewYorkState',
            location_label: 'New York State',
        });
        expect(donny.userNational).toBe('USA');
        expect(donny.userRegional).toBe('New York State');
        expect(postMatchesLocationTab(donny, 'usa')).toBe(true);
        expect(postMatchesLocationTab(donny, 'dublin')).toBe(false);
    });

    it('never treats the name before @ as a location', () => {
        const parisInCork = transformLaravelPost({
            id: 'name-paris-place-cork',
            user_handle: 'Paris@Cork',
        });
        expect(parisInCork.userLocal).toBe('Cork');
        expect(parisInCork.userNational).toBe('Ireland');
        expect(postMatchesLocationTab(parisInCork, 'ireland')).toBe(true);
        expect(postMatchesLocationTab(parisInCork, 'paris')).toBe(false);
        expect(postMatchesLocationTab(parisInCork, 'dublin')).toBe(false);

        const irelandInCork = transformLaravelPost({
            id: 'name-ireland-place-cork',
            user_handle: 'Ireland@Cork',
        });
        expect(irelandInCork.userLocal).toBe('Cork');
        expect(postMatchesLocationTab(irelandInCork, 'dublin')).toBe(false);

        const dublinInCork = transformLaravelPost({
            id: 'name-dublin-place-cork',
            user_handle: 'dublin@cork',
        });
        expect(dublinInCork.userLocal).toBe('Cork');
        expect(postMatchesLocationTab(dublinInCork, 'dublin')).toBe(false);
        expect(postMatchesLocationTab(dublinInCork, 'cork')).toBe(true);
    });
});

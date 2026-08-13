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

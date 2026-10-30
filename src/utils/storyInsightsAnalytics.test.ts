import { describe, expect, it } from 'vitest';
import type { StoryInsight } from '../api/stories';
import {
    classifyStoryViewOrigin,
    summarizeStoryInsights,
    storyInsightRowStats,
} from './storyInsightsAnalytics';

const creator = { local: 'Finglas', regional: 'Dublin', national: 'Ireland' };

function insight(partial: Partial<StoryInsight>): StoryInsight {
    return {
        storyId: 's1',
        createdAt: 1,
        views: 0,
        viewers: [],
        likes: 0,
        likers: [],
        reactions: [],
        replies: [],
        ...partial,
    };
}

describe('classifyStoryViewOrigin', () => {
    it('maps handle place to local / regional / discover', () => {
        expect(classifyStoryViewOrigin('Ann@Finglas', creator)).toBe('local');
        expect(classifyStoryViewOrigin('Bob@Dublin', creator)).toBe('regional');
        expect(classifyStoryViewOrigin('Cara@London', creator)).toBe('discover');
        expect(classifyStoryViewOrigin('no-place', creator)).toBe('discover');
    });
});

describe('summarizeStoryInsights', () => {
    it('totals views, completion, direct shares, and reach', () => {
        const stats = summarizeStoryInsights(
            [
                insight({
                    views: 4,
                    viewers: ['Ann@Finglas', 'Bob@Dublin', 'Cara@London'],
                    replies: [{ userHandle: 'Ann@Finglas', text: 'nice', createdAt: 1 }],
                    reactions: [{ userHandle: 'Bob@Dublin', emoji: '❤️', createdAt: 1 }],
                }),
            ],
            creator,
        );
        expect(stats.totalViews).toBe(4);
        expect(stats.uniqueViewers).toBe(3);
        expect(stats.directShares).toBe(1);
        expect(stats.localViews).toBe(1);
        expect(stats.regionalViews).toBe(1);
        expect(stats.discoverViews).toBe(2);
        expect(stats.completionRate).toBe(67);
    });

    it('treats missing insights as empty', () => {
        expect(summarizeStoryInsights(undefined, creator).totalViews).toBe(0);
    });
});

describe('storyInsightRowStats', () => {
    it('computes per-story completion from engaged viewers', () => {
        const row = storyInsightRowStats(
            insight({
                views: 2,
                viewers: ['Ann@Finglas', 'Bob@Dublin'],
                likers: ['Ann@Finglas'],
                likes: 1,
            }),
        );
        expect(row.views).toBe(2);
        expect(row.completionRate).toBe(50);
        expect(row.directShares).toBe(0);
    });
});

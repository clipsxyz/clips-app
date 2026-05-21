import { describe, expect, it } from 'vitest';
import {
    classifyBoostStatus,
    getQualityLabel,
    estimateReachTeaser,
    boostStatusLabel,
} from './boostPostGrid';
import type { Post } from '../types';

function mockPost(overrides: Partial<Post> = {}): Post {
    return {
        id: 'p1',
        userHandle: '@test',
        stats: { views: 100, likes: 5, comments: 2, shares: 1, reclips: 0 },
        createdAt: Date.now(),
        ...overrides,
    } as Post;
}

describe('boostPostGrid', () => {
    it('classifies active boost', () => {
        expect(classifyBoostStatus(mockPost({ isBoosted: true }))).toBe('active');
    });

    it('classifies ended boost', () => {
        expect(classifyBoostStatus(mockPost({ boostFeedType: 'local', isBoosted: false }))).toBe('ended');
    });

    it('classifies ready', () => {
        expect(classifyBoostStatus(mockPost())).toBe('ready');
    });

    it('returns quality label', () => {
        const label = getQualityLabel(mockPost());
        expect(label.label.length).toBeGreaterThan(0);
    });

    it('formats reach teaser', () => {
        expect(estimateReachTeaser(mockPost())).toMatch(/Estimated reach/);
    });

    it('formats status label', () => {
        expect(boostStatusLabel('active')).toBe('Active boost');
    });
});

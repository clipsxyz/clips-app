import { describe, expect, it } from 'vitest';
import {
    storyLinkBrandForUrl,
    storyLinkFaviconUrl,
    storyLinkHostname,
    storyLinkNewsName,
    storyLinkSlugHeadline,
} from './storyLinkBrand';

describe('storyLinkBrandForUrl', () => {
    it('reads the hostname without www', () => {
        expect(storyLinkHostname('https://www.tiktok.com/@gazetteer/video/1')).toBe('tiktok.com');
        expect(storyLinkHostname('youtu.be/abc')).toBe('youtu.be');
    });

    it('uses each platform’s brand colors', () => {
        expect(storyLinkBrandForUrl('https://www.tiktok.com/t/abc').id).toBe('tiktok');
        expect(storyLinkBrandForUrl('https://www.tiktok.com/t/abc').accent).toBe('#25F4EE');
        expect(storyLinkBrandForUrl('https://www.instagram.com/reel/abc').background).toBe('#1A0A18');
        expect(storyLinkBrandForUrl('https://news.sky.com/story/live').background).toBe('#6E0B16');
        expect(storyLinkBrandForUrl('https://youtu.be/abc').id).toBe('youtube');
        expect(storyLinkBrandForUrl('https://x.com/gazetteer/status/1').id).toBe('twitter');
        expect(storyLinkBrandForUrl('https://www.rte.ie/news/').canvas[1]).toBe('#123044');
        expect(storyLinkBrandForUrl('https://www.tiktok.com/t/abc').canvas[0]).toBe('#050505');
        expect(storyLinkBrandForUrl('https://www.tiktok.com/t/abc').cta).toBe('Watch on TikTok');
        expect(storyLinkBrandForUrl('https://youtu.be/abc').cta).toBe('Watch on YouTube');
        expect(storyLinkBrandForUrl('https://www.rte.ie/news/').cta).toBe('Read on RTÉ');
        expect(storyLinkBrandForUrl('https://news.sky.com/story/live').cta).toBe('Read on Sky News');
        expect(storyLinkBrandForUrl('https://www.amazon.co.uk/dp/1').cta).toBe('Shop on Amazon');
        expect(storyLinkBrandForUrl('https://www.amazon.co.uk/dp/1').accent).toBe('#FF9900');
        expect(storyLinkBrandForUrl('https://www.amazon.co.uk/dp/1').background).toBe('#111111');
        expect(storyLinkBrandForUrl('https://amzn.to/abc').id).toBe('amazon');
    });

    it('uses a high-res favicon for the site, including known publishers', () => {
        expect(storyLinkFaviconUrl('https://vm.tiktok.com/Zabc')).toBe(
            'https://www.google.com/s2/favicons?domain=tiktok.com&sz=128',
        );
        expect(storyLinkFaviconUrl('https://www.rte.ie/news/')).toContain('domain=rte.ie');
        expect(storyLinkFaviconUrl('https://news.sky.com/story/1')).toContain('domain=news.sky.com');
        expect(storyLinkFaviconUrl('https://example.com/a')).toContain('domain=example.com');
        expect(storyLinkFaviconUrl('https://www.amazon.co.uk/dp/1')).toContain('domain=amazon.com');
    });

    it('builds a news headline from the article slug when metadata is blocked', () => {
        expect(storyLinkNewsName('https://news.sky.com/story/minister-quits-13204521')).toBe('Sky News');
        expect(storyLinkNewsName('https://www.bbc.com/news/articles/abc')).toBe('BBC');
        expect(storyLinkNewsName('https://www.rte.ie/news/')).toBe('RTÉ');
        expect(
            storyLinkSlugHeadline(
                'https://news.sky.com/story/minister-quits-over-budget-row-13204521',
            ),
        ).toBe('Minister Quits over Budget Row');
        expect(
            storyLinkSlugHeadline(
                'https://www.rte.ie/news/politics/2026/1103/1234567-budget-row-continues/',
            ),
        ).toBe('Budget Row Continues');
        expect(storyLinkSlugHeadline('https://www.bbc.com/news/articles/cydd3j0j0j0o')).toBe('');
        expect(storyLinkSlugHeadline('https://www.tiktok.com/@gazetteer/video/1')).toBe('');
    });

    it('keeps an unknown site on the dark card', () => {
        expect(storyLinkBrandForUrl('https://example.com/story').id).toBe('default');
        expect(storyLinkBrandForUrl('https://example.com/story').cta).toBe('Visit Website');
        expect(storyLinkBrandForUrl('').id).toBe('default');
    });
});

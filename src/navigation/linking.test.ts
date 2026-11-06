import { describe, expect, it } from 'vitest';
import { linking } from './linking';

describe('gazetteer linking', () => {
    it('includes the app scheme and gazetteer.com', () => {
        expect(linking.prefixes).toContain('gazetteer://');
        expect(linking.prefixes).toContain('https://gazetteer.com');
        expect(linking.config.initialRouteName).toBe('MainTabs');
    });

    it('routes a paid boost callback to the Boost tab', () => {
        const state = linking.getStateFromPath(
            'boost/success?session_id=cs_test_abc123',
            linking.config,
        );
        expect(state?.routes).toEqual([
            {
                name: 'MainTabs',
                state: {
                    index: 1,
                    routes: [
                        { name: 'Home' },
                        {
                            name: 'Boost',
                            state: {
                                index: 0,
                                routes: [
                                    {
                                        name: 'BoostMain',
                                        params: { initialAction: 'success', session_id: 'cs_test_abc123' },
                                    },
                                ],
                            },
                        },
                        { name: 'Create' },
                        { name: 'Search' },
                        { name: 'Inbox' },
                    ],
                },
            },
        ]);
        const bare = linking.getStateFromPath('gazetteer://boost/success', linking.config);
        const tabs = bare?.routes?.[0] as { name: string; state?: { index?: number; routes?: Array<{ name: string }> } };
        expect(tabs?.name).toBe('MainTabs');
        expect(tabs?.state?.index).toBe(1);
        expect(tabs?.state?.routes?.map((route) => route.name)).toEqual([
            'Home',
            'Boost',
            'Create',
            'Search',
            'Inbox',
        ]);
    });

    it('routes boost cancel, post, and story links', () => {
        expect(linking.getStateFromPath('boost/cancel', linking.config)?.routes?.map((route) => route.name)).toEqual([
            'MainTabs',
            'BoostCancel',
        ]);
        expect(linking.getStateFromPath('post/post-9', linking.config)?.routes?.[0]).toMatchObject({
            name: 'PostDetail',
            params: { postId: 'post-9' },
        });
        expect(linking.getStateFromPath('story/story-4', linking.config)?.routes?.[0]).toMatchObject({
            name: 'StoryViewer',
            params: { storyId: 'story-4' },
        });
    });

    it('keeps public share tokens on the guest viewer', () => {
        const state = linking.getStateFromPath('p/share-token', linking.config);
        expect(state?.routes?.[0]).toMatchObject({
            name: 'PublicPost',
            params: { token: 'share-token' },
        });
    });
});

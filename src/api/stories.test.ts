import { describe, it, expect } from 'vitest';
import { mapLaravelStoryToStory } from './stories';

/**
 * Regression guards for shared-post stories.
 *
 * transformLaravelStoryToStory is an explicit whitelist. When it dropped
 * shared_from_post_id / shared_from_user_handle / video_poster_url the rail lost the
 * "Shared a post" reference and its thumbnail, and audience was silently rewritten to
 * public — so scoped shares leaked and looked broken after a refresh.
 */
describe('mapLaravelStoryToStory shared-post fields', () => {
    const base = {
        id: 's1',
        user_id: 'u1',
        user_handle: 'Gazetteer@Dublin',
        media_url: 'https://example.com/shared.jpg',
        media_type: 'image',
    };

    it('passes through the shared post reference and poster', () => {
        const story = mapLaravelStoryToStory({
            ...base,
            shared_from_post_id: 'post-uuid',
            shared_from_user_handle: 'Alice@Finglas',
            video_poster_url: 'https://example.com/poster.jpg',
        });

        expect(story.sharedFromPost).toBe('post-uuid');
        expect(story.sharedFromUser).toBe('Alice@Finglas');
        expect(story.videoPosterUrl).toBe('https://example.com/poster.jpg');
    });

    it('preserves the audience scope instead of defaulting to public', () => {
        expect(mapLaravelStoryToStory({ ...base, audience: 'close_friends' }).audience).toBe(
            'close_friends',
        );
        expect(mapLaravelStoryToStory({ ...base, audience: 'only_me' }).audience).toBe('only_me');
    });

    it('tolerates stories with no shared reference', () => {
        const story = mapLaravelStoryToStory(base);
        expect(story.sharedFromPost).toBeUndefined();
        expect(story.sharedFromUser).toBeUndefined();
        expect(story.videoPosterUrl).toBeUndefined();
    });
});
import { describe, expect, it } from 'vitest';
import { transformLaravelPost } from '../api/posts';
import type { Post } from '../types';
import { getReclipDisplay } from './feedPostMeta';

function post(partial: Partial<Post> & Pick<Post, 'id' | 'userHandle'>): Post {
    return {
        locationLabel: 'Dublin',
        tags: [],
        createdAt: Date.now(),
        stats: { likes: 0, views: 0, comments: 0, shares: 0, reclips: 0 },
        ...partial,
    } as Post;
}

describe('getReclipDisplay', () => {
    it('labels a followed user’s reclip of someone else’s post', () => {
        const reclip = post({
            id: 'gazetteer-reclip',
            userHandle: 'Gazetteer@Dublin',
            isReclipped: true,
            originalUserHandle: 'Paris@CountyCork',
        });
        const view = getReclipDisplay(reclip, 'Donny@NewYorkState');
        expect(view.isReclip).toBe(true);
        expect(view.displayHandle).toBe('Gazetteer@Dublin');
        expect(view.originalHandle).toBe('Paris@CountyCork');
    });

    it('does not treat an original post as a reclip', () => {
        const original = post({
            id: 'paris-original',
            userHandle: 'Paris@CountyCork',
            isReclipped: false,
        });
        const view = getReclipDisplay(original, 'Donny@NewYorkState');
        expect(view.isReclip).toBe(false);
        expect(view.originalHandle).toBeUndefined();
    });
});

describe('transformLaravelPost reclip fields', () => {
    it('keeps original author on a Following reclip payload', () => {
        const mapped = transformLaravelPost({
            id: 'gazetteer-reclip',
            user_handle: 'Gazetteer@Dublin',
            is_reclipped: 1,
            original_user_handle: 'Paris@CountyCork',
            original_post_id: 'paris-original',
        });
        expect(mapped.isReclipped).toBe(true);
        expect(mapped.userHandle).toBe('Gazetteer@Dublin');
        expect(mapped.originalUserHandle).toBe('Paris@CountyCork');
    });
});

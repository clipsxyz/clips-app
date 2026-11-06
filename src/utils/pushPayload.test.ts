import { describe, expect, it } from 'vitest';
import { extractPushPayload } from './pushPayload';

describe('extractPushPayload', () => {
    it('reads notification title and body plus string data', () => {
        const payload = extractPushPayload({
            notification: { title: 'New like', body: 'Ava liked your clip' },
            data: { type: 'like', post_id: 'post-1', badge: '3' },
        });
        expect(payload.title).toBe('New like');
        expect(payload.body).toBe('Ava liked your clip');
        expect(payload.data).toEqual({ type: 'like', post_id: 'post-1', badge: '3' });
        expect(payload.badge).toBe(3);
    });

    it('falls back to data title and body when the notification block is missing', () => {
        const payload = extractPushPayload({
            data: { title: 'Story', body: 'Mike replied', story_id: 's1', type: 'story' },
        });
        expect(payload.title).toBe('Story');
        expect(payload.body).toBe('Mike replied');
        expect(payload.badge).toBeNull();
    });
});

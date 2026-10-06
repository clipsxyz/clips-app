import { describe, it, expect } from 'vitest';
import { isMigratedApiRequestPath } from './client';

/**
 * Regression guards for the `apiRequest` allowlist.
 *
 * `createStory` POSTs to exactly `/stories` (no trailing slash). The allowlist only
 * carried the `/stories/` prefix, so the bare resource root failed the check, threw
 * CONNECTION_REFUSED, and createStory silently fell back to the in-memory mock. The
 * story looked fine for the session and vanished on the next cold start because it was
 * never persisted. These tests pin the resource-root match so it cannot regress.
 */
describe('isMigratedApiRequestPath stories', () => {
    it('treats the stories create root as migrated', () => {
        expect(isMigratedApiRequestPath('/stories')).toBe(true);
    });

    it('still matches nested story routes', () => {
        expect(isMigratedApiRequestPath('/stories/paged')).toBe(true);
        expect(isMigratedApiRequestPath('/stories/paged?limit=20')).toBe(true);
        expect(isMigratedApiRequestPath('/stories/abc-123/view')).toBe(true);
        expect(isMigratedApiRequestPath('/stories/user/Gazetteer@Dublin')).toBe(true);
    });

    it('does not match unrelated endpoints', () => {
        expect(isMigratedApiRequestPath('/not-a-real-route')).toBe(false);
        expect(isMigratedApiRequestPath('/story')).toBe(false);
    });

    it('matches other migrated resource roots', () => {
        expect(isMigratedApiRequestPath('/posts')).toBe(true);
        expect(isMigratedApiRequestPath('/collections')).toBe(true);
        expect(isMigratedApiRequestPath('/chat-groups')).toBe(true);
    });
});
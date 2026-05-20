import type { Story, StoryGroup } from '../types';

export const GAZETTEER_WORLD_USER_ID = 'gazetteer-world';
export const GAZETTEER_WORLD_HANDLE = 'Gazetteer@world highlights';

export function createGazetteerWorldStories(): Story[] {
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const expiresAt = now + twentyFourHours;

    return [
        {
            id: 'gazetteer-world-1',
            userId: GAZETTEER_WORLD_USER_ID,
            userHandle: GAZETTEER_WORLD_HANDLE,
            text: 'World highlights: top Clips24 stories from around the globe today.',
            textStyle: {
                background: 'linear-gradient(145deg, #0f172a, #1d4ed8, #22c55e)',
                color: '#ffffff',
                size: 'medium',
            },
            createdAt: now - 2 * 60 * 60 * 1000,
            expiresAt,
            views: 0,
            hasViewed: false,
            reactions: [],
            replies: [],
        },
        {
            id: 'gazetteer-world-2',
            userId: GAZETTEER_WORLD_USER_ID,
            userHandle: GAZETTEER_WORLD_HANDLE,
            text: 'Gazetteer editors pick today’s must-see stories and news.',
            textStyle: {
                background: 'linear-gradient(145deg, #581c87, #db2777)',
                color: '#ffffff',
                size: 'medium',
            },
            createdAt: now - 4 * 60 * 60 * 1000,
            expiresAt,
            views: 0,
            hasViewed: false,
            reactions: [],
            replies: [],
        },
    ];
}

export function withGazetteerWorldGroup(groups: StoryGroup[]): StoryGroup[] {
    if (groups.some((g) => g.userId === GAZETTEER_WORLD_USER_ID || g.userHandle === GAZETTEER_WORLD_HANDLE)) {
        return groups;
    }

    const gazetteerGroup: StoryGroup = {
        userId: GAZETTEER_WORLD_USER_ID,
        userHandle: GAZETTEER_WORLD_HANDLE,
        name: 'Gazetteer World Highlights',
        stories: createGazetteerWorldStories(),
    };

    return [gazetteerGroup, ...groups];
}

export function isGazetteerWorldGroup(group: StoryGroup | undefined): boolean {
    if (!group) return false;
    return group.userId === GAZETTEER_WORLD_USER_ID || group.userHandle === GAZETTEER_WORLD_HANDLE;
}

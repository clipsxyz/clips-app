import { getFollowState, getState } from '../api/posts';

const BASE_LIKER_HANDLES = [
    'Ava@galway',
    'Bob@Ireland',
    'Clara@London',
    'Diego@Madrid',
    'Eimear@Dublin',
    'Farah@Dubai',
    'Gabe@NYC',
    'Hana@Tokyo',
    'Imran@Karachi',
    'Jules@Paris',
];

/** Mock liker list aligned with web EngagementBar likes sheet. */
export function generateFeedLikerHandles(likeCount: number): string[] {
    const maxToShow = Math.min(100, Math.max(0, likeCount));
    const generated: string[] = [];
    for (let i = 0; i < maxToShow; i++) {
        const base = BASE_LIKER_HANDLES[i % BASE_LIKER_HANDLES.length];
        const suffixIndex = Math.floor(i / BASE_LIKER_HANDLES.length);
        generated.push(suffixIndex === 0 ? base : `${base}_${suffixIndex + 1}`);
    }
    return generated;
}

export function getFollowingSetForHandles(userId: string, handles: string[]): Set<string> {
    const state = getState(userId);
    const following = new Set<string>();
    handles.forEach((handle) => {
        if (getFollowState(state.follows, handle)) following.add(handle);
    });
    return following;
}

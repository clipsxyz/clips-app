import { parsePlacesFromBio } from './suggestedPlaces';

/** Resolve places for profile “Places” action (Travel Info, bio parsing). */
export function getEffectivePlacesTraveled(profileUser: any, authUser?: any): string[] {
    const fromProfileList =
        Array.isArray(profileUser?.placesTraveled) && profileUser.placesTraveled.length > 0
            ? profileUser.placesTraveled.filter((s: unknown) => typeof s === 'string')
            : [];
    if (fromProfileList.length > 0) return fromProfileList;

    const fromAuthList =
        Array.isArray(authUser?.placesTraveled) && authUser.placesTraveled.length > 0
            ? authUser.placesTraveled.filter((s: unknown) => typeof s === 'string')
            : [];
    if (fromAuthList.length > 0) return fromAuthList;

    const profileBio = typeof profileUser?.bio === 'string' ? profileUser.bio : '';
    const authBio = typeof authUser?.bio === 'string' ? authUser.bio : '';
    const merged = [...parsePlacesFromBio(profileBio), ...parsePlacesFromBio(authBio)];
    return [...new Set(merged)];
}

export function formatProfileStatCount(value: number): string {
    if (value > 1000) return `${(value / 1000).toFixed(1)}K`;
    return String(value);
}

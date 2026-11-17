/** Saved places for the profile Places sheet. The bio is not a place list. */
export function getEffectivePlacesTraveled(profileUser: any, authUser?: any): string[] {
    const fromProfileList =
        Array.isArray(profileUser?.placesTraveled) && profileUser.placesTraveled.length > 0
            ? profileUser.placesTraveled.filter((s: unknown) => typeof s === 'string' && s.trim().length > 0)
            : [];
    if (fromProfileList.length > 0) return fromProfileList;

    const fromAuthList =
        Array.isArray(authUser?.placesTraveled) && authUser.placesTraveled.length > 0
            ? authUser.placesTraveled.filter((s: unknown) => typeof s === 'string' && s.trim().length > 0)
            : [];
    return fromAuthList;
}

export function formatProfileStatCount(value: number): string {
    if (value > 1000) return `${(value / 1000).toFixed(1)}K`;
    return String(value);
}

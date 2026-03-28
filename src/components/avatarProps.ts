import type { MouseEvent as ReactMouseEvent } from 'react';

/** Shared Avatar API for web (`Avatar.tsx`) and native (`Avatar.native.tsx`). */
export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl' | number;

export type AvatarProps = {
    src?: string;
    name: string;
    size?: AvatarSize;
    /** Web / NativeWind only; ignored on native. */
    className?: string;
    hasStory?: boolean;
    /** Web: button click event. Native: `onClick()` is called with no argument. */
    onClick?: (e?: ReactMouseEvent<HTMLButtonElement>) => void;
};

export function getAvatarInitials(fullName: string): string {
    const names = fullName.trim().split(/\s+/).filter(Boolean);
    if (names.length === 0) return '?';
    if (names.length === 1) {
        return names[0].charAt(0).toUpperCase();
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
}

export function resolveAvatarDimensions(size: AvatarSize = 'md'): { dim: number; fontSize: number } {
    if (typeof size === 'number' && Number.isFinite(size) && size > 0) {
        const dim = Math.round(size);
        return { dim, fontSize: Math.max(10, Math.round(dim * 0.36)) };
    }
    switch (size) {
        case 'sm':
            return { dim: 32, fontSize: 12 };
        case 'lg':
            return { dim: 48, fontSize: 16 };
        case 'xl':
            return { dim: 64, fontSize: 18 };
        case 'md':
        default:
            return { dim: 40, fontSize: 14 };
    }
}

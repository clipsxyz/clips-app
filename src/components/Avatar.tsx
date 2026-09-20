import React from 'react';
import type { AvatarProps } from './avatarProps';
import { getAvatarInitials, resolveAvatarDimensions } from './avatarProps';
import { resolveAvatarImageUri } from '../api/users';
import {
    STORIES_24_AVATAR_RING_COLORS,
    STORIES_24_AVATAR_RING_SEEN,
} from '../constants/stories24Ring';

export default function Avatar({
    src,
    name,
    size = 'md',
    className = '',
    hasStory = false,
    hasUnviewedStory = false,
    onClick,
    handle,
}: AvatarProps) {
    const initials = getAvatarInitials(name);
    const isNumericSize = typeof size === 'number';
    const { dim, fontSize } = isNumericSize ? resolveAvatarDimensions(size) : { dim: 0, fontSize: 14 };
    const handleHint =
        handle || (typeof name === 'string' && name.includes('@') ? name : undefined);
    const imageSrc = resolveAvatarImageUri(src, handleHint);

    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
        xl: 'w-16 h-16 text-lg',
    } as const;

    const sizeClass = !isNumericSize && typeof size === 'string' && size in sizeClasses
        ? sizeClasses[size as keyof typeof sizeClasses]
        : '';

    const avatarContent = (
        <>
            {imageSrc ? (
                <img
                    src={imageSrc}
                    alt={`${name}'s profile picture`}
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                />
            ) : null}
            <div
                className={`absolute inset-0 rounded-full flex items-center justify-center font-bold text-white ${
                    src ? 'opacity-0' : 'opacity-100'
                } transition-opacity duration-200`}
                style={{ background: '#000000', ...(isNumericSize ? { fontSize } : {}) }}
            >
                {initials}
            </div>
        </>
    );

    const baseClassName = isNumericSize
        ? `${className} ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''} relative rounded-full`
        : `${sizeClass} ${className} ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`;

    const handleClick = onClick
        ? (e: React.MouseEvent<HTMLButtonElement>) => onClick(e)
        : undefined;

    const showRing = hasStory || hasUnviewedStory;
    const unviewed = Boolean(hasUnviewedStory);
    const storyRingStyle = unviewed
        ? {
              background: `linear-gradient(to top right, ${STORIES_24_AVATAR_RING_COLORS.join(', ')})`,
          }
        : {
              background: STORIES_24_AVATAR_RING_SEEN,
          };

    const inner = showRing ? (
        <>
            <div
                className={`absolute -inset-0.5 rounded-full p-[2px] ${unviewed ? 'stories24-ring-pulse' : ''}`}
                style={storyRingStyle}
            >
                <div className="w-full h-full rounded-full bg-black" />
            </div>
            <div
                className="absolute inset-[2px] rounded-full overflow-hidden flex items-center justify-center bg-black"
                style={isNumericSize ? { width: dim, height: dim } : undefined}
            >
                {avatarContent}
            </div>
        </>
    ) : (
        <div
            className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-white dark:bg-gray-950"
            style={isNumericSize ? { width: dim, height: dim } : undefined}
        >
            {avatarContent}
        </div>
    );

    const outerStyle = isNumericSize
        ? {
              width: showRing ? dim + 4 : dim,
              height: showRing ? dim + 4 : dim,
          }
        : undefined;

    if (onClick) {
        return (
            <button
                type="button"
                onClick={handleClick}
                className={`${baseClassName} relative rounded-full ${showRing ? 'overflow-visible' : 'overflow-hidden'}`}
                style={outerStyle}
            >
                {inner}
            </button>
        );
    }

    return (
        <div
            className={`${baseClassName} relative rounded-full ${showRing ? 'overflow-visible' : 'overflow-hidden'}`}
            style={outerStyle}
        >
            {inner}
        </div>
    );
}

import React from 'react';
import type { AvatarProps } from './avatarProps';
import { getAvatarInitials, resolveAvatarDimensions } from './avatarProps';

export default function Avatar({
    src,
    name,
    size = 'md',
    className = '',
    hasStory = false,
    onClick,
}: AvatarProps) {
    const initials = getAvatarInitials(name);
    const isNumericSize = typeof size === 'number';
    const { dim, fontSize } = isNumericSize ? resolveAvatarDimensions(size) : { dim: 0, fontSize: 14 };

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
            {src ? (
                <img
                    src={src}
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

    const storyRingStyle = { background: 'linear-gradient(135deg, #22d3ee 0%, #14b8a6 100%)' };

    const inner = hasStory ? (
        <>
            <div className="absolute -inset-0.5 rounded-full p-[2px]" style={storyRingStyle}>
                <div className="w-full h-full rounded-full bg-white dark:bg-gray-950" />
            </div>
            <div
                className="absolute inset-[2px] rounded-full overflow-hidden flex items-center justify-center bg-white dark:bg-gray-950"
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
              width: hasStory ? dim + 4 : dim,
              height: hasStory ? dim + 4 : dim,
          }
        : undefined;

    if (onClick) {
        return (
            <button
                type="button"
                onClick={handleClick}
                className={`${baseClassName} relative rounded-full ${hasStory ? 'overflow-visible' : 'overflow-hidden'}`}
                style={outerStyle}
            >
                {inner}
            </button>
        );
    }

    return (
        <div
            className={`${baseClassName} relative rounded-full ${hasStory ? 'overflow-visible' : 'overflow-hidden'}`}
            style={outerStyle}
        >
            {inner}
        </div>
    );
}

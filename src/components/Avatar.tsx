import React from 'react';

interface AvatarProps {
    src?: string;
    name: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    hasStory?: boolean;
    onClick?: (e?: React.MouseEvent) => void;
}

export default function Avatar({ src, name, size = 'md', className = '', hasStory = false, onClick }: AvatarProps) {
    // Get initials from name (first letter of first name + first letter of last name)
    const getInitials = (fullName: string): string => {
        const names = fullName.trim().split(' ');
        if (names.length === 1) {
            return names[0].charAt(0).toUpperCase();
        }
        return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    };

    const initials = getInitials(name);

    // Size classes
    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
        xl: 'w-16 h-16 text-lg'
    };

    const sizeClass = sizeClasses[size];

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
            {/* Fallback initials */}
            <div
                className={`absolute inset-0 rounded-full flex items-center justify-center font-bold text-white ${src ? 'opacity-0' : 'opacity-100'
                    } transition-opacity duration-200`}
                style={{ background: '#000000' }}
            >
                {initials}
            </div>
        </>
    );

    const baseClassName = `${sizeClass} ${className} ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`;
    const handleClick = onClick ? (e: React.MouseEvent) => {
        onClick(e);
    } : undefined;

    const storyRingStyle = { background: 'linear-gradient(135deg, #22d3ee 0%, #14b8a6 100%)' };

    const inner = hasStory ? (
        <>
            <div className="absolute -inset-0.5 rounded-full p-[2px]" style={storyRingStyle}>
                <div className="w-full h-full rounded-full bg-white dark:bg-gray-950" />
            </div>
            <div className="absolute inset-[2px] rounded-full overflow-hidden flex items-center justify-center bg-white dark:bg-gray-950">
                {avatarContent}
            </div>
        </>
    ) : (
        <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-white dark:bg-gray-950">
            {avatarContent}
        </div>
    );

    if (onClick) {
        return (
            <button
                onClick={handleClick}
                className={`${baseClassName} relative rounded-full ${hasStory ? 'overflow-visible' : 'overflow-hidden'}`}
            >
                {inner}
            </button>
        );
    }

    return (
        <div
            className={`${baseClassName} relative rounded-full ${hasStory ? 'overflow-visible' : 'overflow-hidden'}`}
        >
            {inner}
        </div>
    );
}

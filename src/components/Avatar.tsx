import React from 'react';

interface AvatarProps {
    src?: string;
    name: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    hasStory?: boolean;
    onClick?: () => void;
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

    const Component = onClick ? 'button' : 'div';

    // Wrap with border if hasStory
    if (hasStory) {
        return (
            <Component
                onClick={onClick}
                className={`${sizeClass} ${className} ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
            >
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-blue-400 via-cyan-400 to-green-400 p-[2.5px] animate-pulse">
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-950 to-gray-900 flex items-center justify-center overflow-hidden">
                        <div className={`${sizeClass} rounded-full overflow-hidden`}>
                            {src ? (
                                <img
                                    src={src}
                                    alt={`${name}'s profile picture`}
                                    className="w-full h-full object-cover"
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
                        </div>
                    </div>
                </div>
            </Component>
        );
    }

    return (
        <Component
            onClick={onClick}
            className={`${sizeClass} ${className} rounded-full overflow-hidden flex items-center justify-center relative ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
        >
            {src ? (
                <img
                    src={src}
                    alt={`${name}'s profile picture`}
                    className="w-full h-full object-cover"
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
        </Component>
    );
}

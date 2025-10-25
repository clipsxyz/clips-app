import React from 'react';

interface AvatarProps {
    src?: string;
    name: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export default function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
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

    return (
        <div className={`${sizeClass} ${className} rounded-full overflow-hidden flex items-center justify-center relative`}>
            {src ? (
                <img
                    src={src}
                    alt={`${name}'s profile picture`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        // If image fails to load, hide it to show fallback
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                />
            ) : null}

            {/* Fallback initials - always rendered but hidden when image is present */}
            <div
                className={`absolute inset-0 rounded-full flex items-center justify-center font-bold text-white ${src ? 'opacity-0' : 'opacity-100'
                    } transition-opacity duration-200`}
                style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 50%, #1d4ed8 100%)', // Green to blue gradient
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                }}
            >
                {initials}
            </div>
        </div>
    );
}

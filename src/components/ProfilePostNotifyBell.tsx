import React from 'react';
import { FiBell } from 'react-icons/fi';

type Props = {
    active: boolean;
    className?: string;
};

/** Bell for profile post notifications — same icon on/off; CSS wiggle when active. */
export default function ProfilePostNotifyBell({ active, className = 'w-5 h-5' }: Props) {
    return (
        <span
            className={`inline-flex items-center justify-center ${
                active ? 'profile-notify-bell--active' : 'profile-notify-bell--idle'
            }`}
            aria-hidden
        >
            <FiBell className={`${className} ${active ? 'opacity-100' : 'opacity-80'}`} />
        </span>
    );
}

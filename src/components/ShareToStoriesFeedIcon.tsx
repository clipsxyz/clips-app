import React from 'react';

/** Instagram-style “add to story”: dashed circle + centered plus (feed share-to-stories affordance). */
export default function ShareToStoriesFeedIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
            {/* Geometry scaled up vs first pass so optical size matches Feather ~24px actions (they fill more of the canvas). */}
            <circle
                cx="12"
                cy="12"
                r="10.25"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="2.55 2.55"
                strokeLinecap="round"
            />
            <path d="M12 7.35v9.3M7.35 12h9.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

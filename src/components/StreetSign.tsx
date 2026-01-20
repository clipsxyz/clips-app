import React from 'react';

type StreetSignProps = {
    topLabel?: string;
    bottomLabel?: string;
};

/**
 * StreetSign
 * 
 * Web version of the two-green-street-signs design:
 * - Top sign: time (e.g. "2h ago")
 * - Bottom sign: location (e.g. "Artane, Dublin")
 * 
 * This is purely presentational; pass already-formatted strings.
 */
export default function StreetSign({ topLabel = '', bottomLabel = '' }: StreetSignProps) {
    // If both labels are empty, render nothing
    if (!topLabel && !bottomLabel) return null;

    return (
        <div className="pointer-events-none">
            <svg
                width={180}
                height={120}
                viewBox="0 0 400 250"
                aria-hidden="true"
                className="drop-shadow-[0_6px_18px_rgba(0,0,0,0.7)]"
            >
                {/* Pole */}
                <rect x="190" y="40" width="20" height="180" fill="#9e9e9e" rx="4" />

                {/* Top sign (location) - extends to the left of the pole */}
                <g>
                    <rect
                        x="40"          // starts left of the pole
                        y="50"
                        width="180"
                        height="46"
                        rx="10"
                        fill="#1b5e20"
                        stroke="#ffffff"
                        strokeWidth="2"
                    />
                    <text
                        x="130"        // centered on the top sign
                        y="79"
                        fill="#ffffff"
                        fontSize="18"
                        fontWeight="bold"
                        textAnchor="middle"
                        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}
                    >
                        {topLabel}
                    </text>
                </g>

                {/* Bottom sign (time) - extends to the right of the pole */}
                <g>
                    <rect
                        x="200"        // starts at the pole and extends right
                        y="110"
                        width="180"
                        height="46"
                        rx="10"
                        fill="#1b5e20"
                        stroke="#ffffff"
                        strokeWidth="2"
                    />
                    <text
                        x="290"        // centered on the bottom sign
                        y="139"
                        fill="#ffffff"
                        fontSize="18"
                        fontWeight="bold"
                        textAnchor="middle"
                        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}
                    >
                        {bottomLabel}
                    </text>
                </g>
            </svg>
        </div>
    );
}


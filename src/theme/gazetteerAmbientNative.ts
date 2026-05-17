/** Shared Gazetteer ambient UI tokens (React Native). */
export const GAZETTEER_ABYSS = '#0b0711';

export const glassSurface = {
    backgroundColor: 'rgba(24, 24, 28, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
} as const;

export const glassSearch = {
    backgroundColor: 'rgba(30, 30, 32, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
} as const;

export const glassPanel = {
    backgroundColor: 'rgba(26, 21, 36, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
} as const;

export const greetingLight = {
    fontSize: 32,
    fontWeight: '300' as const,
    letterSpacing: -0.5,
    lineHeight: 40,
    color: '#e3e3e3',
    textAlign: 'center' as const,
};

export const greetingSubLight = {
    fontSize: 14,
    fontWeight: '300' as const,
    letterSpacing: -0.2,
    color: 'rgba(227, 227, 227, 0.72)',
    textAlign: 'center' as const,
};

/** Bottom tab navigator — matches Gazetteer dark chrome. */
export const gazetteerTabBar = {
    backgroundColor: 'rgba(11, 7, 17, 0.94)',
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    borderTopWidth: 1,
} as const;

export const gazetteerTabActiveTint = '#f472b6';
export const gazetteerTabInactiveTint = '#9CA3AF';

export const chipActiveMagenta = {
    borderColor: 'rgba(217, 27, 92, 0.55)',
    backgroundColor: 'rgba(217, 27, 92, 0.2)',
} as const;

export const chipActiveMagentaText = {
    color: '#FBCFE8',
} as const;

export const gazetteerHeader = {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
} as const;

export const gazetteerTabActiveBorder = '#f472b6';

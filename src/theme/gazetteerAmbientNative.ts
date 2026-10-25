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

/** Profile / Passport page — matches web ProfilePage (`bg-[#030712]`, card borders). */
export const profilePassportPageBg = '#030712';
export const profilePassportSurface = '#020617';
export const profilePassportScrollInset = 24;
export const profilePassportCardsInset = 16;
export const profilePassportCardGap = 12;

export const profilePassportCardBorderLine = 'rgba(255, 255, 255, 0.12)';
export const profilePassportEditHubBorderLine = 'rgba(255, 255, 255, 0.1)';

/** Web: `bg-[#020617] border border-white/12 rounded-2xl` */
export const profilePassportCard = {
    backgroundColor: profilePassportSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: profilePassportCardBorderLine,
} as const;

/** Web: `border border-white/10 bg-white/[0.03] rounded-2xl` */
export const profilePassportEditHub = {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: profilePassportEditHubBorderLine,
} as const;

export const profilePassportChipBorder = 'rgba(255, 255, 255, 0.15)';

export const profilePassportQuickAction = {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    backgroundColor: '#000000',
} as const;

export const profileCardIconSurface = {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
};

/** Structural dividers on profile chrome (web `border-gray-800`). */
export const profilePassportDivider = '#1F2937';

/**
 * Champions League test canvas — midnight navy + electric cyan + neon magenta/purple.
 * Applied only to the Post options swal (`PostOverflowMenuModal`) until we promote it.
 */
export const UCL_CANVAS_NAVY = '#03091B';
export const UCL_CANVAS_NAVY_MID = '#071330';
export const UCL_CYAN = '#00F2FF';
export const UCL_MAGENTA = '#FF0080';
export const UCL_PURPLE = '#7000FF';
export const UCL_SHEET_GRADIENT = ['#03091B', '#071330', '#160830', '#0A051C'] as const;
export const UCL_SHEET_GRADIENT_LOCATIONS = [0, 0.42, 0.78, 1] as const;
export const UCL_SHEET_BORDER = 'rgba(0, 242, 255, 0.45)';
export const UCL_SHEET_ROW_BORDER = 'rgba(0, 242, 255, 0.14)';
export const UCL_SHEET_SURFACE = 'rgba(0, 242, 255, 0.06)';
export const UCL_SHEET_TEXT = '#FFFFFF';
export const UCL_SHEET_TEXT_MUTED = 'rgba(0, 242, 255, 0.55)';
/** High-contrast type on the navy canvas. */
export const UCL_TEXT_PRIMARY = '#FFFFFF';
export const UCL_TEXT_SECONDARY = '#D1E4FF';
export const UCL_TEXT_PLACEHOLDER = '#94A3B8';
export const UCL_TEXT_ACTIVE = UCL_CYAN;

/** UEFA Champions League vibrant royal blue gradient */
export const UEFA_CYAN = '#00F2FF';
export const UEFA_ROYAL_BLUE_START = '#0A194E';
export const UEFA_ROYAL_BLUE_MID = '#0038D1';
export const UEFA_ROYAL_BLUE_END = '#020B26';
export const UEFA_PASSPORT_GRADIENT = ['#000000', '#23104F'] as const;
export const UEFA_PASSPORT_GRADIENT_LOCATIONS = [0, 1] as const;
export const UEFA_GLASS_BG = 'rgba(2, 11, 38, 0.75)';
export const UEFA_GLASS_BORDER = 'rgba(0, 242, 255, 0.25)';
export const UEFA_CYAN_GLOW = 'rgba(0, 242, 255, 0.6)';

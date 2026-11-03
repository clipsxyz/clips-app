export type StoryLinkBrandTheme = {
    id: string;
    /** Card container fill. */
    background: string;
    /** Signature accent for the border and highlights. */
    accent: string;
    /** Slightly lifted panel behind the avatar when there is no thumbnail. */
    surface: string;
    /** Full-bleed story canvas behind the card. */
    canvas: readonly [string, string, string];
    /** Ionicons glyph for the platform badge. Empty for a generic link. */
    logo: string;
    /** Button label for this site, e.g. "Watch on TikTok" or "Read on RTÉ". */
    cta: string;
};

const DEFAULT_BRAND: StoryLinkBrandTheme = {
    id: 'default',
    background: '#111827',
    accent: 'rgba(255,255,255,0.16)',
    surface: 'rgba(255,255,255,0.06)',
    canvas: ['#0B1220', '#111827', '#070B12'],
    logo: 'link-outline',
    cta: 'Visit Website',
};

type BrandRule = StoryLinkBrandTheme & {
    hosts: string[];
};

const BRANDS: BrandRule[] = [
    {
        id: 'tiktok',
        hosts: ['tiktok.com'],
        background: '#121212',
        accent: '#25F4EE',
        surface: '#1C2424',
        canvas: ['#050505', '#102422', '#050505'],
        logo: 'logo-tiktok',
        cta: 'Watch on TikTok',
    },
    {
        id: 'instagram',
        hosts: ['instagram.com', 'instagr.am'],
        background: '#1A0A18',
        accent: '#E1306C',
        surface: '#2A1224',
        canvas: ['#140610', '#3A1028', '#0C060A'],
        logo: 'logo-instagram',
        cta: 'View on Instagram',
    },
    {
        id: 'youtube',
        hosts: ['youtube.com', 'youtu.be'],
        background: '#0F0F0F',
        accent: '#FF0033',
        surface: '#1A1A1A',
        canvas: ['#0A0A0A', '#1A080A', '#0A0A0A'],
        logo: 'logo-youtube',
        cta: 'Watch on YouTube',
    },
    {
        id: 'twitter',
        hosts: ['twitter.com', 'x.com'],
        background: '#000000',
        accent: '#1D9BF0',
        surface: '#16181C',
        canvas: ['#000000', '#0C141C', '#000000'],
        logo: 'logo-twitter',
        cta: 'View on X',
    },
    {
        id: 'skynews',
        hosts: ['news.sky.com', 'skynews.com'],
        background: '#6E0B16',
        accent: '#FF4D4D',
        surface: '#8A1220',
        canvas: ['#2A060C', '#6E0B16', '#140308'],
        logo: '',
        cta: 'Read on Sky News',
    },
    {
        id: 'rte',
        hosts: ['rte.ie'],
        background: '#0E1C28',
        accent: '#F5C400',
        surface: '#163044',
        canvas: ['#071018', '#123044', '#071018'],
        logo: '',
        cta: 'Read on RTÉ',
    },
    {
        id: 'bbc',
        hosts: ['bbc.co.uk', 'bbc.com'],
        background: '#0B0B0B',
        accent: '#BB1919',
        surface: '#1A1A1A',
        canvas: ['#070707', '#1A1010', '#070707'],
        logo: '',
        cta: 'Read on BBC',
    },
    {
        id: 'facebook',
        hosts: ['facebook.com', 'fb.com', 'fb.watch'],
        background: '#0A1628',
        accent: '#1877F2',
        surface: '#12243C',
        canvas: ['#061018', '#0E2440', '#061018'],
        logo: 'logo-facebook',
        cta: 'View on Facebook',
    },
    {
        id: 'reddit',
        hosts: ['reddit.com'],
        background: '#1A0A00',
        accent: '#FF4500',
        surface: '#2A1408',
        canvas: ['#100800', '#2A1206', '#100800'],
        logo: 'logo-reddit',
        cta: 'View on Reddit',
    },
    {
        id: 'linkedin',
        hosts: ['linkedin.com'],
        background: '#061422',
        accent: '#0A66C2',
        surface: '#0E2438',
        canvas: ['#041018', '#0C2844', '#041018'],
        logo: 'logo-linkedin',
        cta: 'View on LinkedIn',
    },
    {
        id: 'amazon',
        hosts: [
            'amazon.com',
            'amazon.co.uk',
            'amazon.ie',
            'amazon.de',
            'amazon.fr',
            'amazon.es',
            'amazon.it',
            'amazon.ca',
            'amazon.com.au',
            'amazon.in',
            'amzn.to',
            'amzn.eu',
            'a.co',
        ],
        background: '#111111',
        accent: '#FF9900',
        surface: '#1C1C1C',
        canvas: ['#FF9900', '#C45500', '#111111'],
        logo: '',
        cta: 'Shop on Amazon',
    },
];

/** Hostname without scheme or `www.`, lowercased. Empty when the URL cannot be read. */
export function storyLinkHostname(url?: string | null): string {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        return new URL(withProtocol).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
        const bare = raw
            .replace(/^https?:\/\//i, '')
            .split(/[/?#]/)[0]
            .replace(/^www\./i, '')
            .toLowerCase();
        return bare.includes('.') ? bare : '';
    }
}

function hostMatches(hostname: string, root: string): boolean {
    return hostname === root || hostname.endsWith(`.${root}`);
}

/** Brand theme for a shared link. Unknown sites keep the dark story card. */
export function storyLinkBrandForUrl(url?: string | null): StoryLinkBrandTheme {
    const hostname = storyLinkHostname(url);
    if (!hostname) return DEFAULT_BRAND;
    const match = BRANDS.find((brand) => brand.hosts.some((root) => hostMatches(hostname, root)));
    if (!match) return DEFAULT_BRAND;
    return {
        id: match.id,
        background: match.background,
        accent: match.accent,
        surface: match.surface,
        canvas: match.canvas,
        logo: match.logo,
        cta: match.cta,
    };
}

/** Social apps with a logo get a badge card when the thumbnail is missing. */
export function storyLinkUsesPlatformBadge(url?: string | null): boolean {
    return storyLinkBrandForUrl(url).logo.startsWith('logo-');
}

/**
 * Publishers that often block Open Graph fetches.
 * The card still shows this name and a slug headline when no metadata arrives.
 */
const NEWS_PUBLISHERS: { hosts: string[]; name: string }[] = [
    { hosts: ['news.sky.com', 'skynews.com'], name: 'Sky News' },
    { hosts: ['bbc.co.uk', 'bbc.com'], name: 'BBC' },
    { hosts: ['rte.ie'], name: 'RTÉ' },
    { hosts: ['theguardian.com'], name: 'The Guardian' },
    { hosts: ['irishtimes.com'], name: 'The Irish Times' },
    { hosts: ['independent.ie'], name: 'Irish Independent' },
    { hosts: ['thejournal.ie'], name: 'The Journal' },
    { hosts: ['reuters.com'], name: 'Reuters' },
    { hosts: ['cnn.com'], name: 'CNN' },
];

/** Display name for a news publisher, or empty when the URL is not one of those sites. */
export function storyLinkNewsName(url?: string | null): string {
    const hostname = storyLinkHostname(url);
    if (!hostname) return '';
    const match = NEWS_PUBLISHERS.find((publisher) =>
        publisher.hosts.some((root) => hostMatches(hostname, root)),
    );
    return match?.name || '';
}

const SLUG_SECTIONS = new Set([
    'news',
    'story',
    'stories',
    'article',
    'articles',
    'video',
    'videos',
    'live',
    'watch',
    'sport',
    'sports',
    'uk',
    'world',
    'index',
    'home',
    'latest',
    'breaking',
]);

const SMALL_WORDS = new Set([
    'a',
    'an',
    'the',
    'of',
    'on',
    'in',
    'to',
    'for',
    'and',
    'or',
    'at',
    'by',
    'from',
    'over',
]);

function titleCaseSlugWord(word: string, isFirst: boolean): string {
    if (!isFirst && SMALL_WORDS.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Turn one path segment into a headline, or return empty when it is only an id or section. */
function headlineFromSlugSegment(segment: string): string {
    let decoded = segment;
    try {
        decoded = decodeURIComponent(segment);
    } catch {
        decoded = segment;
    }
    const stripped = decoded
        .toLowerCase()
        .replace(/\.(html?|php|aspx)$/i, '')
        .replace(/^\d{4,}[-_]*/, '')
        .replace(/[-_]*\d{4,}$/, '')
        .trim();
    if (!stripped || SLUG_SECTIONS.has(stripped) || /^\d+$/.test(stripped)) return '';
    const words = stripped
        .split(/[-_]+/)
        .filter((word) => word && !/^\d+$/.test(word) && !/\d/.test(word) && /[a-z]/i.test(word));
    if (words.length < 2) return '';
    return words.map((word, index) => titleCaseSlugWord(word, index === 0)).join(' ');
}

/**
 * Readable headline from an article slug when Open Graph title never arrives.
 * `.../minister-quits-over-budget-row-13204521` becomes "Minister Quits over Budget Row".
 */
export function storyLinkSlugHeadline(url?: string | null): string {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let path = '';
    try {
        path = new URL(withProtocol).pathname;
    } catch {
        return '';
    }
    const parts = path.split('/').map((part) => part.trim()).filter(Boolean);
    for (let index = parts.length - 1; index >= 0; index -= 1) {
        const headline = headlineFromSlugSegment(parts[index]);
        if (headline) return headline;
    }
    return '';
}

/** Canonical site used for the favicon, so `vm.tiktok.com` still shows TikTok’s mark. */
const FAVICON_DOMAIN: Record<string, string> = {
    tiktok: 'tiktok.com',
    instagram: 'instagram.com',
    youtube: 'youtube.com',
    twitter: 'x.com',
    skynews: 'news.sky.com',
    rte: 'rte.ie',
    bbc: 'bbc.co.uk',
    facebook: 'facebook.com',
    reddit: 'reddit.com',
    linkedin: 'linkedin.com',
    amazon: 'amazon.com',
};

/**
 * High-resolution site icon when Open Graph has no thumbnail.
 * Known publishers use their main domain; everything else uses that hostname.
 */
export function storyLinkFaviconUrl(url?: string | null): string {
    const brand = storyLinkBrandForUrl(url);
    const domain = FAVICON_DOMAIN[brand.id] || storyLinkHostname(url);
    if (!domain) return '';
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

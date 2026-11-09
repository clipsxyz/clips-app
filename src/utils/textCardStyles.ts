export type TextCardStyleId = 'gradient-sunset' | 'gradient-midnight' | 'minimal-charcoal';

export const TEXT_CARD_STYLES: Record<
    TextCardStyleId,
    { label: string; colors: string[]; textColor: string; bordered?: boolean }
> = {
    'gradient-sunset': {
        label: 'Sunset',
        colors: ['#7C3AED', '#DB2777'],
        textColor: '#FFFFFF',
    },
    'gradient-midnight': {
        label: 'Midnight',
        colors: ['#0B1B3A', '#1D4ED8'],
        textColor: '#FFFFFF',
    },
    'minimal-charcoal': {
        label: 'Charcoal',
        colors: ['#1E1E1E'],
        textColor: '#FFFFFF',
        bordered: true,
    },
};

export const TEXT_CARD_STYLE_OPTIONS = (
    Object.keys(TEXT_CARD_STYLES) as TextCardStyleId[]
).map((id) => ({ id, ...TEXT_CARD_STYLES[id] }));

export function isTextCardStyleId(value: unknown): value is TextCardStyleId {
    return value === 'gradient-sunset' || value === 'gradient-midnight' || value === 'minimal-charcoal';
}

export type TextCardStyleId =
    | 'gradient-sunset'
    | 'gradient-midnight'
    | 'gradient-amber'
    | 'gradient-emerald'
    | 'minimal-charcoal';

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
    'gradient-amber': {
        label: 'Yellow',
        colors: ['#FDE047', '#F59E0B'],
        textColor: '#1A1206',
    },
    'gradient-emerald': {
        label: 'Emerald',
        colors: ['#064E3B', '#34D399'],
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
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TEXT_CARD_STYLES, value);
}

/** CSS background string the story viewer can turn back into a gradient. */
export function textCardStyleBackground(id: TextCardStyleId): string {
    const spec = TEXT_CARD_STYLES[id];
    if (spec.colors.length >= 2) {
        return `linear-gradient(135deg, ${spec.colors[0]} 0%, ${spec.colors[1]} 100%)`;
    }
    return spec.colors[0];
}

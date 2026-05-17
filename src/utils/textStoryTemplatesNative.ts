import { TEXT_STORY_TEMPLATES, type TextStoryTemplate } from '../textStoryTemplates';

export type NativeTextStoryTemplate = TextStoryTemplate & {
    backgroundColor: string;
};

function solidFromBackground(background: string): string {
    const trimmed = background.trim();
    if (!trimmed.includes('gradient') && !trimmed.includes('radial')) {
        return trimmed;
    }
    const hex = trimmed.match(/#[0-9a-fA-F]{3,8}/);
    return hex?.[0] || '#1e3a8a';
}

/** Curated templates with solid RN background colors (gradients approximated by first stop). */
export const NATIVE_TEXT_STORY_TEMPLATES: NativeTextStoryTemplate[] = TEXT_STORY_TEMPLATES.filter(
    (t) => t.id && t.name,
)
    .slice(0, 18)
    .map((template) => ({
        ...template,
        backgroundColor: solidFromBackground(template.background),
    }));

export function getNativeTextStoryTemplate(id?: string | null): NativeTextStoryTemplate | undefined {
    if (!id) return undefined;
    return NATIVE_TEXT_STORY_TEMPLATES.find((t) => t.id === id);
}

export function buildTextStyleFromTemplate(template: NativeTextStoryTemplate) {
    return {
        color: template.textColor,
        size: template.textSize,
        background: template.backgroundColor,
        fontFamily: template.fontFamily,
    };
}

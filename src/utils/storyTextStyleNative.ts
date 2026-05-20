import { TEXT_STORY_TEMPLATES } from '../textStoryTemplates';
import type { Post, Story } from '../types';

/** Pull hex colors from CSS gradient/color strings for RN LinearGradient. */
export function gradientColorsFromCss(background: string | undefined): string[] {
    const bg = (background || '').trim();
    if (!bg) return ['#1a1a1a', '#201138', '#0b0711'];
    if (bg.startsWith('#')) return [bg, bg, bg];
    const hex = bg.match(/#[0-9a-fA-F]{3,8}/g);
    if (hex && hex.length >= 2) {
        return [hex[0], hex[Math.floor(hex.length / 2)], hex[hex.length - 1]];
    }
    return ['#1a1a1a', '#312e81', '#0b0711'];
}

export function storyTextFontSize(size?: string): number {
    if (size === 'small') return 14;
    if (size === 'large') return 22;
    return 17;
}

export function getStoryTextContent(story: Story | undefined): string {
    if (!story) return '';
    return (
        (story.text || (story as { text_content?: string }).text_content || '').trim() ||
        (story.poll?.question || '').trim()
    );
}

export function getTextStoryStyle(story: Story, originalPost?: Post | null) {
    const template = originalPost?.templateId
        ? TEXT_STORY_TEMPLATES.find((t) => t.id === originalPost.templateId)
        : undefined;
    const background =
        story.textStyle?.background ||
        originalPost?.textStyle?.background ||
        template?.background ||
        '#1a1a1a';
    const color =
        story.textStyle?.color ||
        story.textColor ||
        originalPost?.textStyle?.color ||
        template?.textColor ||
        '#ffffff';
    const size =
        story.textStyle?.size ||
        story.textSize ||
        originalPost?.textStyle?.size ||
        template?.textSize ||
        'medium';
    return {
        gradientColors: gradientColorsFromCss(background),
        color,
        fontSize: storyTextFontSize(size),
    };
}

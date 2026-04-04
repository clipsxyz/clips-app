import type { Post } from '../types';
import { TEXT_STORY_TEMPLATES } from '../textStoryTemplates';

/** Same merge as FeedCard: `templateId` + optional `textStyle` overrides. */
export function getEffectiveTextStyleForPost(
  post: Post,
): { color?: string; size?: 'small' | 'medium' | 'large'; background?: string; fontFamily?: string } | undefined {
  const templateForText = post.templateId ? TEXT_STORY_TEMPLATES.find((t) => t.id === post.templateId) : undefined;
  let effective: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string; fontFamily?: string } | undefined =
    post.textStyle;

  if (templateForText) {
    effective = {
      background: templateForText.background,
      color: templateForText.textColor,
      size: templateForText.textSize,
      fontFamily: templateForText.fontFamily,
      ...(post.textStyle || {}),
    };
  }

  return effective;
}

const FALLBACK_BACKGROUNDS = [
  '#1e3a8a',
  '#1e40af',
  '#1d4ed8',
  '#2563eb',
  '#3b82f6',
  '#1e293b',
  '#0f172a',
  '#1a202c',
];

/** Background for text-only grid / peek when no template solid/gradient is set. */
export function getTextOnlyFallbackBackground(post: Post): string {
  const t = getEffectiveTextStyleForPost(post)?.background;
  if (t) return t;
  const text = post.text || '';
  return FALLBACK_BACKGROUNDS[text.length % FALLBACK_BACKGROUNDS.length];
}

export function getTextOnlyPreviewTextClass(size: 'small' | 'medium' | 'large' | undefined): string {
  switch (size || 'medium') {
    case 'small':
      return 'text-sm';
    case 'large':
      return 'text-xl';
    case 'medium':
    default:
      return 'text-base';
  }
}

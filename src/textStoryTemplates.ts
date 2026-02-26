export type TextStoryTemplateSize = 'small' | 'medium' | 'large';

export interface TextStoryTemplate {
  id: string;
  name: string;
  background: string; // CSS color or gradient string
  textColor: string; // CSS color
  textSize: TextStoryTemplateSize;
  fontFamily: string; // CSS font-family string
}

export const TEXT_STORY_TEMPLATES: TextStoryTemplate[] = [
  {
    id: 'minimal-white',
    name: 'Minimal',
    background: '#ffffff',
    textColor: '#111827',
    textSize: 'medium',
    fontFamily: 'Georgia, \"Times New Roman\", serif',
  },
  {
    id: 'night-mode',
    name: 'Night',
    background: 'radial-gradient(circle at top, #111827, #020617)',
    textColor: '#f9fafb',
    textSize: 'medium',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif',
  },
  {
    id: 'gazetteer-gradient',
    name: 'Gazetteer',
    background: 'linear-gradient(135deg,#3b82f6,#a855f7)',
    textColor: '#ffffff',
    textSize: 'medium',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif',
  },
  {
    id: 'paper-map',
    name: 'Map',
    background: 'linear-gradient(135deg,#4b5563,#111827)',
    textColor: '#f9fafb',
    textSize: 'medium',
    fontFamily: 'Georgia, \"Times New Roman\", serif',
  },
  {
    id: 'polaroid',
    name: 'Polaroid',
    background: '#e5e7eb',
    textColor: '#111827',
    textSize: 'medium',
    fontFamily: '\"Times New Roman\", Georgia, serif',
  },
  {
    id: 'postcard',
    name: 'Postcard',
    background: '#f3f4f6',
    textColor: '#111827',
    textSize: 'small',
    fontFamily: 'Georgia, \"Times New Roman\", serif',
  },
  {
    id: 'bold-color',
    name: 'Bold',
    background: '#f97316',
    textColor: '#ffffff',
    textSize: 'large',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif',
  },
  {
    id: 'highlight',
    name: 'Highlight',
    background: '#fef9c3',
    textColor: '#111827',
    textSize: 'medium',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif',
  },
  {
    id: 'sticky-note',
    name: 'Note',
    background: '#fde68a',
    textColor: '#111827',
    textSize: 'medium',
    fontFamily: '\"Comic Sans MS\", \"Comic Sans\", cursive',
  },
  {
    id: 'chat-bubble',
    name: 'Chat',
    background: '#e0f2fe',
    textColor: '#0f172a',
    textSize: 'medium',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif',
  },
  // Extra templates with different font styles
  {
    id: 'elegant-script',
    name: 'Script',
    background: 'linear-gradient(135deg,#0f172a,#1e293b)',
    textColor: '#f9fafb',
    textSize: 'medium',
    fontFamily: '\"Palatino Linotype\",\"Book Antiqua\",Palatino,serif',
  },
  {
    id: 'mono-terminal',
    name: 'Mono',
    background: '#020617',
    textColor: '#e5e7eb',
    textSize: 'small',
    fontFamily: '\"Courier New\",Courier,monospace',
  },
  {
    id: 'playful-bubble',
    name: 'Bubble',
    background: 'linear-gradient(135deg,#f97316,#ec4899)',
    textColor: '#ffffff',
    textSize: 'large',
    fontFamily: '\"Trebuchet MS\",\"Lucida Grande\",\"Lucida Sans Unicode\",sans-serif',
  },
  {
    id: 'newspaper',
    name: 'News',
    background: '#f5f5f4',
    textColor: '#111827',
    textSize: 'small',
    fontFamily: '\"Times New Roman\",Georgia,serif',
  },
  {
    id: 'marker',
    name: 'Marker',
    background: '#111827',
    textColor: '#facc15',
    textSize: 'medium',
    fontFamily: '\"Comic Sans MS\",\"Comic Sans\",cursive',
  },
  {
    id: 'soft-pastel',
    name: 'Pastel',
    background: 'linear-gradient(135deg,#fee2e2,#e0f2fe)',
    textColor: '#111827',
    textSize: 'medium',
    fontFamily: '\"Verdana\",\"Geneva\",sans-serif',
  },
  {
    id: 'headline',
    name: 'Headline',
    background: '#111827',
    textColor: '#f9fafb',
    textSize: 'large',
    fontFamily: '\"Impact\",\"Haettenschweiler\",\"Arial Narrow Bold\",sans-serif',
  },
  {
    id: 'neon',
    name: 'Neon',
    background: 'radial-gradient(circle at top,#22d3ee,#4c1d95)',
    textColor: '#f9fafb',
    textSize: 'medium',
    fontFamily: '\"Gill Sans\",\"Gill Sans MT\",Calibri,\"Trebuchet MS\",sans-serif',
  },
];


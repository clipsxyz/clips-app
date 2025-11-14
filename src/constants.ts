/**
 * Application-wide constants
 */

// Double-tap detection threshold (in milliseconds)
export const DOUBLE_TAP_THRESHOLD = 350;

// Animation durations (in milliseconds)
export const ANIMATION_DURATIONS = {
  HEART_BURST: 400,
  HEART_POPUP: 800,
  SHIMMER: 6000,
} as const;

// Template IDs
export const TEMPLATE_IDS = {
  INSTAGRAM: 'template-7',
  TIKTOK: 'template-8',
  GAZETTEER: 'template-9',
} as const;

// Maximum clips for top templates
export const MAX_CLIPS = 20;
export const MIN_CLIPS = 1;

// Default clip duration (in milliseconds)
export const DEFAULT_CLIP_DURATION = 15000;

// Gradient colors for templates
export const TEMPLATE_GRADIENTS = {
  INSTAGRAM: 'linear-gradient(90deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5, #feda75)',
  TIKTOK: 'linear-gradient(90deg, #69c9d0, #ee1d52, #000000, #69c9d0)',
  GAZETTEER: 'linear-gradient(to right, rgb(255, 140, 0) 5%, rgb(248, 0, 50) 25%, rgb(255, 0, 160) 45%, rgb(140, 40, 255) 65%, rgb(0, 35, 255) 82%, rgb(25, 160, 255) 96%)',
  SILVER_WHITE: 'linear-gradient(90deg, #C0C0C0, #FFFFFF, #D3D3D3, #FFFFFF, #A8A8A8, #FFFFFF, #C0C0C0, #FFFFFF, #D3D3D3, #FFFFFF, #A8A8A8, #C0C0C0)',
  MARKETING: 'linear-gradient(90deg, #87ceeb, #ffb6c1, #87cefa, #c084fc, #34d399, #f59e0b, #ef4444, #dc2626, #fca5a5, #60a5fa, #fb7185, #87ceeb)',
} as const;

// Aspect ratios
export const ASPECT_RATIOS = {
  TEMPLATE_CARD: '9/16',
} as const;

// Z-index layers
export const Z_INDEX = {
  HEADER: 50,
  HEART_ANIMATION: 50,
  MODAL: 100,
} as const;







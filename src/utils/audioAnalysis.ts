/**
 * Stub for audio analysis used by avatar renderer (lip-sync / animation params).
 * Replace with real implementation when needed.
 */

export interface AudioAnalysis {
  duration?: number;
  emotion?: string;
  [key: string]: unknown;
}

export function getAnimationParams(): {
  scale: number;
  rotation: number;
  bounce: number;
  sparkle?: boolean;
} {
  return { scale: 1, rotation: 0, bounce: 0, sparkle: false };
}

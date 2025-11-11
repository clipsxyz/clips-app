// Minimal effect types for compatibility
// Effects functionality removed - only type definitions remain

export type EffectConfig = {
    type: string;
    intensity?: number;
    duration?: number;
    startTime?: number;
    colorGrading?: string;
    [key: string]: any;
};

// Stub functions for compatibility (not used by top 3 templates)
export function getColorGradingFilter(preset: string, intensity: number): string {
    return '';
}

export function getGlitchVHSStyles(intensity: number): React.CSSProperties {
    return {};
}

export const cameraShakeVariants = {};
export const zoomVariants = {};
export const slideVariants = {};
export const flashVariants = {};


import React from 'react';
import { motion } from 'framer-motion';
import { EffectConfig, getColorGradingFilter, getGlitchVHSStyles, cameraShakeVariants, zoomVariants, slideVariants, flashVariants } from '../utils/effects';

interface EffectWrapperProps {
    children: React.ReactNode;
    effect: EffectConfig;
    isActive: boolean;
}

export default function EffectWrapper({ children, effect, isActive }: EffectWrapperProps) {
    if (!isActive) {
        return <>{children}</>;
    }

    const { type, intensity = 1, colorGrading } = effect;

    // Apply CSS filters for color grading
    if (type === 'color-grading' && colorGrading) {
        const filter = getColorGradingFilter(colorGrading, intensity);
        console.log(`Applying color grading: ${colorGrading} with filter: ${filter}`);
        return (
            <div style={{ filter, width: '100%', height: '100%', position: 'relative' }}>
                {children}
            </div>
        );
    }

    // Apply glitch/VHS effect
    if (type === 'glitch-vhs') {
        const styles = getGlitchVHSStyles(intensity);
        return (
            <div style={{ ...styles, width: '100%', height: '100%', position: 'relative' }}>
                {children}
            </div>
        );
    }

    // Apply motion-based effects
    let motionProps: any = {};

    if (type === 'camera-shake') {
        motionProps = {
            animate: intensity > 0.5 ? 'intense' : 'shake',
            variants: cameraShakeVariants,
        };
    } else if (type === 'zoom-in') {
        motionProps = {
            animate: 'zoomIn',
            variants: zoomVariants,
            transition: {
                duration: 0.5,
                ease: 'easeOut',
                repeat: Infinity,
                repeatType: 'reverse' as const,
            },
        };
    } else if (type === 'zoom-out') {
        motionProps = {
            animate: 'zoomOut',
            variants: zoomVariants,
            transition: {
                duration: 0.5,
                ease: 'easeIn',
                repeat: Infinity,
                repeatType: 'reverse' as const,
            },
        };
    } else if (type === '3d-zoom') {
        motionProps = {
            animate: '3d-zoom',
            variants: zoomVariants,
            transition: {
                duration: 1,
                ease: 'easeInOut',
                repeat: Infinity,
                repeatType: 'reverse' as const,
            },
        };
    } else if (type === 'flash') {
        motionProps = {
            animate: 'flash',
            variants: flashVariants,
        };
    } else if (type === 'slide') {
        motionProps = {
            animate: 'slideLeft',
            variants: slideVariants,
        };
    }

    if (Object.keys(motionProps).length > 0) {
        return (
            <motion.div {...motionProps} style={{ width: '100%', height: '100%', position: 'relative' }}>
                {children}
            </motion.div>
        );
    }

    return <>{children}</>;
}


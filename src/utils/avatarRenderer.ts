/**
 * Professional Avatar Rendering System
 * Creates high-quality animated cartoon avatars matching the design spec
 * Based on the image: cheerful character with curly brown hair, orange hoodie
 */

import { AudioAnalysis } from './audioAnalysis';
import { analyzeMouthShape, MouthShape } from './lipSync';

export interface AvatarStyle {
    id: string;
    name: string;
    hairColor: string;
    skinColor: string;
    clothingColor: string;
    hairStyle: 'curly' | 'straight' | 'spiky' | 'wavy';
    expression: 'happy' | 'excited' | 'calm' | 'neutral';
}

// Store audio buffer for lip sync
let currentAudioBuffer: AudioBuffer | null = null;

/**
 * Set audio buffer for lip-syncing
 */
export function setAudioBufferForLipSync(buffer: AudioBuffer | null) {
    currentAudioBuffer = buffer;
}

/**
 * Draw a professional-quality animated avatar matching the image spec
 */
export function drawAvatar(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    avatarId: string,
    analysis: AudioAnalysis,
    animationParams: ReturnType<typeof import('./audioAnalysis').getAnimationParams>,
    _progress: number,
    time: number
) {
    // Draw background scene (cityscape through window)
    drawBackgroundScene(ctx, width, height, time);

    const centerX = width / 2;
    const centerY = height / 2 - 30;

    ctx.save();
    ctx.translate(centerX, centerY);

    // Smooth animations
    const scale = 1 + (animationParams.scale - 1) * 0.5 + Math.sin(time * 2) * 0.03;
    const rotation = animationParams.rotation * Math.sin(time * 1.5) * 0.05;
    const bounce = Math.sin(time * 3) * animationParams.bounce * 0.3;

    ctx.scale(scale, scale);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(0, bounce);

    // Get avatar style - match the image: curly brown hair, orange hoodie
    const style = getAvatarStyle(avatarId, analysis.emotion);

    // Get mouth shape for lip sync
    let mouthShape: MouthShape = 'closed';
    if (currentAudioBuffer) {
        mouthShape = analyzeMouthShape(currentAudioBuffer, time);
    }

    // Draw professional character matching the image
    drawImageMatchingCharacter(ctx, style, analysis, time, animationParams, mouthShape);

    ctx.restore();

    // Draw thought bubble with emotion icon
    drawThoughtBubble(ctx, centerX, centerY - 280, analysis.emotion, time);

    // Draw sparkles if enabled
    if (animationParams.sparkle) {
        drawProfessionalSparkles(ctx, centerX, centerY, width, height, time);
    }
}

/**
 * Draw background scene matching the image (cityscape through window)
 */
function drawBackgroundScene(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
) {
    // Sky gradient (sunset/sunrise colors)
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.6);
    skyGradient.addColorStop(0, '#FF6B9D'); // Pink
    skyGradient.addColorStop(0.3, '#FFA500'); // Orange
    skyGradient.addColorStop(0.6, '#FFD700'); // Gold
    skyGradient.addColorStop(1, '#87CEEB'); // Sky blue
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height * 0.6);

    // City skyline silhouette
    const cityY = height * 0.6;
    ctx.fillStyle = '#2C3E50';
    ctx.beginPath();

    // Building shapes
    const buildings = [
        { x: 0, width: width * 0.15, height: height * 0.25 },
        { x: width * 0.12, width: width * 0.12, height: height * 0.35 },
        { x: width * 0.22, width: width * 0.18, height: height * 0.3 },
        { x: width * 0.38, width: width * 0.15, height: height * 0.4 },
        { x: width * 0.51, width: width * 0.14, height: height * 0.28 },
        { x: width * 0.63, width: width * 0.16, height: height * 0.38 },
        { x: width * 0.77, width: width * 0.12, height: height * 0.32 },
        { x: width * 0.87, width: width * 0.13, height: height * 0.35 },
    ];

    buildings.forEach(building => {
        ctx.fillRect(building.x, cityY - building.height, building.width, building.height);

        // Add windows with lights
        const windowRows = Math.floor(building.height / 40);
        const windowCols = Math.floor(building.width / 25);
        ctx.fillStyle = '#FFD700';
        for (let row = 0; row < windowRows; row++) {
            for (let col = 0; col < windowCols; col++) {
                if (Math.random() > 0.3) { // Some windows lit
                    const windowX = building.x + col * 25 + 5;
                    const windowY = cityY - building.height + row * 40 + 5;
                    ctx.fillRect(windowX, windowY, 15, 20);
                }
            }
        }
        ctx.fillStyle = '#2C3E50';
    });

    // Ground/foreground
    ctx.fillStyle = '#34495E';
    ctx.fillRect(0, cityY, width, height - cityY);

    // Airplane in distance (animated)
    const planeX = (time * 50) % (width + 100) - 50;
    const planeY = height * 0.15;
    ctx.fillStyle = '#87CEEB';
    ctx.beginPath();
    ctx.moveTo(planeX, planeY);
    ctx.lineTo(planeX + 30, planeY - 5);
    ctx.lineTo(planeX + 40, planeY);
    ctx.lineTo(planeX + 30, planeY + 5);
    ctx.closePath();
    ctx.fill();
}

/**
 * Get avatar style - default to match the image
 */
function getAvatarStyle(avatarId: string, emotion: AudioAnalysis['emotion']): AvatarStyle {
    const styles: Record<string, AvatarStyle> = {
        avatar1: {
            id: 'avatar1',
            name: 'Happy Guy',
            hairColor: '#8B4513', // Brown hair (matching image)
            skinColor: '#FDBCB4', // Light skin
            clothingColor: '#FF6B35', // Orange hoodie (matching image)
            hairStyle: 'curly', // Curly hair (matching image)
            expression: emotion === 'excited' || emotion === 'happy' ? 'excited' : 'happy',
        },
        avatar2: {
            id: 'avatar2',
            name: 'Cool Dude',
            hairColor: '#2C3E50',
            skinColor: '#F4D03F',
            clothingColor: '#3498DB',
            hairStyle: 'straight',
            expression: 'calm',
        },
        avatar3: {
            id: 'avatar3',
            name: 'Energetic',
            hairColor: '#E74C3C',
            skinColor: '#F8C471',
            clothingColor: '#9B59B6',
            hairStyle: 'spiky',
            expression: 'excited',
        },
        avatar4: {
            id: 'avatar4',
            name: 'Chill',
            hairColor: '#34495E',
            skinColor: '#F7DC6F',
            clothingColor: '#52BE80',
            hairStyle: 'wavy',
            expression: 'calm',
        },
        avatar5: {
            id: 'avatar5',
            name: 'Excited',
            hairColor: '#F39C12',
            skinColor: '#FADBD8',
            clothingColor: '#E91E63',
            hairStyle: 'curly',
            expression: 'excited',
        },
    };

    return styles[avatarId] || styles.avatar1;
}

/**
 * Draw character matching the image specification
 */
function drawImageMatchingCharacter(
    ctx: CanvasRenderingContext2D,
    style: AvatarStyle,
    analysis: AudioAnalysis,
    time: number,
    animationParams: ReturnType<typeof import('./audioAnalysis').getAnimationParams>,
    mouthShape: MouthShape
) {
    const baseSize = 220;

    // Draw body first (orange hoodie)
    drawOrangeHoodie(ctx, style, baseSize, time, animationParams);

    // Draw head
    drawProfessionalHead(ctx, style, baseSize);

    // Draw curly brown hair (matching image)
    drawCurlyBrownHair(ctx, style, baseSize, time);

    // Draw face with lip sync
    drawFaceWithLipSync(ctx, style, analysis, baseSize, time, animationParams, mouthShape);

    // Draw hands (expressive, raised)
    drawExpressiveHands(ctx, style, baseSize, time, animationParams);
}

/**
 * Draw orange hoodie matching the image
 */
function drawOrangeHoodie(
    ctx: CanvasRenderingContext2D,
    _style: AvatarStyle,
    size: number,
    time: number,
    _animationParams: ReturnType<typeof import('./audioAnalysis').getAnimationParams>
) {
    const bodyWidth = size * 0.85;
    const bodyHeight = size * 1.4;
    const bodyY = size * 0.45;

    // Main body shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(0, bodyY + size * 0.05, bodyWidth * 0.52, bodyHeight * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main body with orange gradient
    const bodyGradient = ctx.createLinearGradient(-bodyWidth * 0.5, bodyY - bodyHeight * 0.5, bodyWidth * 0.5, bodyY + bodyHeight * 0.5);
    bodyGradient.addColorStop(0, '#FF8C42'); // Lighter orange
    bodyGradient.addColorStop(0.5, '#FF6B35'); // Orange (matching image)
    bodyGradient.addColorStop(1, '#E55A2B'); // Darker orange
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.ellipse(0, bodyY, bodyWidth * 0.5, bodyHeight * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hood with depth
    const hoodRadius = size * 0.55;
    const hoodY = -size * 0.15;

    // Hood shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.arc(0, hoodY + size * 0.02, hoodRadius, Math.PI * 0.65, Math.PI * 1.35);
    ctx.fill();

    // Hood main (orange)
    const hoodGradient = ctx.createRadialGradient(0, hoodY - size * 0.2, 0, 0, hoodY, hoodRadius);
    hoodGradient.addColorStop(0, '#FFA366');
    hoodGradient.addColorStop(1, '#FF6B35');
    ctx.fillStyle = hoodGradient;
    ctx.beginPath();
    ctx.arc(0, hoodY, hoodRadius, Math.PI * 0.65, Math.PI * 1.35);
    ctx.fill();

    // Hood outline
    ctx.strokeStyle = '#E55A2B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, hoodY, hoodRadius, Math.PI * 0.65, Math.PI * 1.35);
    ctx.stroke();

    // Hood drawstrings
    const stringBounce = Math.sin(time * 3) * 2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-size * 0.18, hoodY + size * 0.05);
    ctx.quadraticCurveTo(-size * 0.28, hoodY + size * 0.15 + stringBounce, -size * 0.32, hoodY + size * 0.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.18, hoodY + size * 0.05);
    ctx.quadraticCurveTo(size * 0.28, hoodY + size * 0.15 + stringBounce, size * 0.32, hoodY + size * 0.25);
    ctx.stroke();

    // Sleeves
    const sleeveY = bodyY + size * 0.1;
    const sleeveRadius = size * 0.18;

    // Left sleeve
    const leftSleeveGradient = ctx.createRadialGradient(-size * 0.55, sleeveY, 0, -size * 0.55, sleeveY, sleeveRadius);
    leftSleeveGradient.addColorStop(0, '#FF8C42');
    leftSleeveGradient.addColorStop(1, '#E55A2B');
    ctx.fillStyle = leftSleeveGradient;
    ctx.beginPath();
    ctx.arc(-size * 0.55, sleeveY, sleeveRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#E55A2B';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Right sleeve
    const rightSleeveGradient = ctx.createRadialGradient(size * 0.55, sleeveY, 0, size * 0.55, sleeveY, sleeveRadius);
    rightSleeveGradient.addColorStop(0, '#FF8C42');
    rightSleeveGradient.addColorStop(1, '#E55A2B');
    ctx.fillStyle = rightSleeveGradient;
    ctx.beginPath();
    ctx.arc(size * 0.55, sleeveY, sleeveRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#E55A2B';
    ctx.lineWidth = 2;
    ctx.stroke();
}

/**
 * Draw professional head
 */
function drawProfessionalHead(ctx: CanvasRenderingContext2D, style: AvatarStyle, size: number) {
    const headRadius = size * 0.42;
    const headY = -size * 0.05;

    // Head shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.ellipse(0, headY + size * 0.02, headRadius * 1.02, headRadius * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head with gradient shading
    const headGradient = ctx.createRadialGradient(0, headY - size * 0.15, 0, 0, headY, headRadius);
    headGradient.addColorStop(0, lightenColor(style.skinColor, 0.25));
    headGradient.addColorStop(0.6, style.skinColor);
    headGradient.addColorStop(1, darkenColor(style.skinColor, 0.15));
    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.ellipse(0, headY, headRadius, headRadius * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head outline
    ctx.strokeStyle = darkenColor(style.skinColor, 0.2);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, headY, headRadius, headRadius * 1.05, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Neck
    const neckWidth = size * 0.15;
    const neckHeight = size * 0.12;
    ctx.fillStyle = style.skinColor;
    ctx.beginPath();
    ctx.ellipse(0, headY + headRadius * 0.8, neckWidth * 0.5, neckHeight * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Draw curly brown hair matching the image
 */
function drawCurlyBrownHair(
    ctx: CanvasRenderingContext2D,
    _style: AvatarStyle,
    size: number,
    time: number
) {
    const hairY = -size * 0.4;
    const hairRadius = size * 0.45;
    const brownColor = '#8B4513'; // Brown hair color

    // Draw individual curly locks
    for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const distance = hairRadius * (0.5 + Math.sin(time * 1.5 + i) * 0.1);
        const x = Math.cos(angle) * distance;
        const y = hairY + Math.sin(angle) * distance * 0.4;
        const curlSize = size * 0.1 + Math.sin(time * 2 + i * 0.5) * size * 0.02;

        // Curl shadow
        ctx.fillStyle = darkenColor(brownColor, 0.4);
        ctx.beginPath();
        ctx.arc(x + 2, y + 2, curlSize, 0, Math.PI * 2);
        ctx.fill();

        // Curl main
        const curlGradient = ctx.createRadialGradient(x, y, 0, x, y, curlSize);
        curlGradient.addColorStop(0, lightenColor(brownColor, 0.25));
        curlGradient.addColorStop(0.7, brownColor);
        curlGradient.addColorStop(1, darkenColor(brownColor, 0.2));
        ctx.fillStyle = curlGradient;
        ctx.beginPath();
        ctx.arc(x, y, curlSize, 0, Math.PI * 2);
        ctx.fill();

        // Curl highlight
        ctx.fillStyle = lightenColor(brownColor, 0.35);
        ctx.beginPath();
        ctx.arc(x - curlSize * 0.35, y - curlSize * 0.35, curlSize * 0.35, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw face with lip-syncing
 */
function drawFaceWithLipSync(
    ctx: CanvasRenderingContext2D,
    style: AvatarStyle,
    analysis: AudioAnalysis,
    size: number,
    time: number,
    animationParams: ReturnType<typeof import('./audioAnalysis').getAnimationParams>,
    mouthShape: MouthShape
) {
    const eyeY = -size * 0.12;
    const eyeSpacing = size * 0.14;
    const eyeSize = size * 0.08;

    // Eye whites
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(-eyeSpacing, eyeY, eyeSize * 1.8, eyeSize * 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(eyeSpacing, eyeY, eyeSize * 1.8, eyeSize * 1.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye outlines
    ctx.strokeStyle = darkenColor(style.skinColor, 0.3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-eyeSpacing, eyeY, eyeSize * 1.8, eyeSize * 1.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(eyeSpacing, eyeY, eyeSize * 1.8, eyeSize * 1.4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Pupils
    const pupilOffsetX = style.expression === 'excited' ? Math.sin(time * 4) * 3 : 0;
    const pupilOffsetY = style.expression === 'excited' ? Math.sin(time * 4.5) * 2 : 0;

    const pupilGradient = ctx.createRadialGradient(-eyeSpacing + pupilOffsetX, eyeY + pupilOffsetY, 0, -eyeSpacing + pupilOffsetX, eyeY + pupilOffsetY, eyeSize * 0.7);
    pupilGradient.addColorStop(0, '#000000');
    pupilGradient.addColorStop(0.7, '#2C3E50');
    pupilGradient.addColorStop(1, '#000000');
    ctx.fillStyle = pupilGradient;
    ctx.beginPath();
    ctx.arc(-eyeSpacing + pupilOffsetX, eyeY + pupilOffsetY, eyeSize * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeSpacing + pupilOffsetX, eyeY + pupilOffsetY, eyeSize * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Eye sparkle
    if (style.expression === 'excited' || analysis.emotion === 'excited') {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-eyeSpacing - eyeSize * 0.4, eyeY - eyeSize * 0.4, eyeSize * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eyeSpacing - eyeSize * 0.4, eyeY - eyeSize * 0.4, eyeSize * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }

    // Eyebrows
    const browY = eyeY - eyeSize * 1.8;
    ctx.strokeStyle = darkenColor(style.hairColor, 0.2);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';

    if (style.expression === 'excited') {
        ctx.beginPath();
        ctx.moveTo(-eyeSpacing - eyeSize * 1.2, browY - size * 0.08);
        ctx.quadraticCurveTo(-eyeSpacing, browY - size * 0.12, -eyeSpacing + eyeSize * 1.2, browY - size * 0.08);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(eyeSpacing - eyeSize * 1.2, browY - size * 0.08);
        ctx.quadraticCurveTo(eyeSpacing, browY - size * 0.12, eyeSpacing + eyeSize * 1.2, browY - size * 0.08);
        ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.moveTo(-eyeSpacing - eyeSize * 1.2, browY);
        ctx.quadraticCurveTo(-eyeSpacing, browY - size * 0.03, -eyeSpacing + eyeSize * 1.2, browY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(eyeSpacing - eyeSize * 1.2, browY);
        ctx.quadraticCurveTo(eyeSpacing, browY - size * 0.03, eyeSpacing + eyeSize * 1.2, browY);
        ctx.stroke();
    }

    // Mouth with lip sync
    const mouthY = size * 0.08;
    drawMouthWithLipSync(ctx, mouthY, size, mouthShape, style, analysis);

    // Cheeks
    if (style.expression === 'excited' || analysis.emotion === 'happy' || analysis.emotion === 'excited') {
        const blushAlpha = 0.4 + Math.sin(time * 2) * 0.1;
        const blushGradient = ctx.createRadialGradient(-size * 0.22, mouthY, 0, -size * 0.22, mouthY, size * 0.1);
        blushGradient.addColorStop(0, `rgba(255, 182, 193, ${blushAlpha})`);
        blushGradient.addColorStop(1, 'rgba(255, 182, 193, 0)');
        ctx.fillStyle = blushGradient;
        ctx.beginPath();
        ctx.arc(-size * 0.22, mouthY, size * 0.1, 0, Math.PI * 2);
        ctx.fill();
        const blushGradient2 = ctx.createRadialGradient(size * 0.22, mouthY, 0, size * 0.22, mouthY, size * 0.1);
        blushGradient2.addColorStop(0, `rgba(255, 182, 193, ${blushAlpha})`);
        blushGradient2.addColorStop(1, 'rgba(255, 182, 193, 0)');
        ctx.fillStyle = blushGradient2;
        ctx.beginPath();
        ctx.arc(size * 0.22, mouthY, size * 0.1, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw mouth with lip-syncing
 */
function drawMouthWithLipSync(
    ctx: CanvasRenderingContext2D,
    mouthY: number,
    size: number,
    mouthShape: MouthShape,
    style: AvatarStyle,
    analysis: AudioAnalysis
) {
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#8B4513';

    switch (mouthShape) {
        case 'closed':
            // Closed mouth
            ctx.beginPath();
            ctx.moveTo(-size * 0.08, mouthY);
            ctx.lineTo(size * 0.08, mouthY);
            ctx.stroke();
            break;

        case 'open':
            // Open mouth (A, E sounds)
            ctx.beginPath();
            ctx.ellipse(0, mouthY, size * 0.12, size * 0.08, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Inside mouth
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.ellipse(0, mouthY, size * 0.1, size * 0.06, 0, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'oh':
            // O sound
            ctx.beginPath();
            ctx.arc(0, mouthY, size * 0.1, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Inside mouth
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(0, mouthY, size * 0.08, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'smile':
            // Happy smile
            ctx.beginPath();
            ctx.arc(0, mouthY, size * 0.14, 0, Math.PI);
            ctx.stroke();
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(0, mouthY, size * 0.14, 0, Math.PI);
            ctx.fill();
            ctx.stroke();
            break;

        case 'f':
            // F sound (teeth on lower lip)
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.rect(-size * 0.06, mouthY - size * 0.03, size * 0.12, size * 0.06);
            ctx.fill();
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-size * 0.08, mouthY);
            ctx.lineTo(size * 0.08, mouthY);
            ctx.stroke();
            break;

        case 'th':
            // TH sound (tongue between teeth)
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.rect(-size * 0.06, mouthY - size * 0.02, size * 0.12, size * 0.04);
            ctx.fill();
            ctx.fillStyle = '#FF69B4';
            ctx.beginPath();
            ctx.ellipse(0, mouthY, size * 0.05, size * 0.03, 0, 0, Math.PI * 2);
            ctx.fill();
            break;

        default:
            // Default smile
            ctx.beginPath();
            ctx.arc(0, mouthY, size * 0.12, 0, Math.PI);
            ctx.stroke();
    }
}

/**
 * Draw expressive hands
 */
function drawExpressiveHands(
    ctx: CanvasRenderingContext2D,
    style: AvatarStyle,
    size: number,
    time: number,
    _animationParams: ReturnType<typeof import('./audioAnalysis').getAnimationParams>
) {
    const handY = size * 0.5;
    const handX = size * 0.58;
    const handSize = size * 0.14;
    const skinColor = style.skinColor;

    // Left hand
    const leftHandGradient = ctx.createRadialGradient(-handX, handY, 0, -handX, handY, handSize);
    leftHandGradient.addColorStop(0, lightenColor(skinColor, 0.2));
    leftHandGradient.addColorStop(1, darkenColor(skinColor, 0.1));
    ctx.fillStyle = leftHandGradient;
    ctx.beginPath();
    ctx.ellipse(-handX, handY, handSize, handSize * 1.3, Math.PI * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darkenColor(skinColor, 0.2);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Right hand
    const rightHandGradient = ctx.createRadialGradient(handX, handY, 0, handX, handY, handSize);
    rightHandGradient.addColorStop(0, lightenColor(skinColor, 0.2));
    rightHandGradient.addColorStop(1, darkenColor(skinColor, 0.1));
    ctx.fillStyle = rightHandGradient;
    ctx.beginPath();
    ctx.ellipse(handX, handY, handSize, handSize * 1.3, -Math.PI * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darkenColor(skinColor, 0.2);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Raised hands when excited
    if (style.expression === 'excited') {
        const raiseAmount = Math.sin(time * 2) * size * 0.12;
        ctx.save();
        ctx.translate(-handX, handY - raiseAmount);
        ctx.rotate(Math.PI * 0.35);
        const raisedGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, handSize);
        raisedGradient.addColorStop(0, lightenColor(skinColor, 0.2));
        raisedGradient.addColorStop(1, darkenColor(skinColor, 0.1));
        ctx.fillStyle = raisedGradient;
        ctx.beginPath();
        ctx.ellipse(0, 0, handSize, handSize * 1.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.translate(handX, handY - raiseAmount);
        ctx.rotate(-Math.PI * 0.35);
        ctx.fillStyle = raisedGradient;
        ctx.beginPath();
        ctx.ellipse(0, 0, handSize, handSize * 1.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

/**
 * Draw thought bubble
 */
function drawThoughtBubble(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    emotion: AudioAnalysis['emotion'],
    time: number
) {
    const bubbleSize = 100;
    const iconSize = 50;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, bubbleSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, bubbleSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x - bubbleSize * 0.6, y + bubbleSize * 0.4, bubbleSize * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - bubbleSize * 0.3, y + bubbleSize * 0.65, bubbleSize * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const emoji = getEmotionEmoji(emotion);
    ctx.font = `bold ${iconSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x, y);
}

function getEmotionEmoji(emotion: AudioAnalysis['emotion']): string {
    switch (emotion) {
        case 'excited': return '🤩';
        case 'energetic': return '⚡';
        case 'happy': return '😊';
        case 'calm': return '😌';
        default: return '😐';
    }
}

function drawProfessionalSparkles(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    _width: number,
    _height: number,
    time: number
) {
    const sparkleCount = 20;

    for (let i = 0; i < sparkleCount; i++) {
        const angle = (i / sparkleCount) * Math.PI * 2;
        const distance = 180 + Math.sin(time * 2 + i) * 40;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        const size = (Math.sin(time * 3 + i) * 0.5 + 0.5) * 8 + 4;
        const alpha = (Math.sin(time * 4 + i) * 0.5 + 0.5) * 0.8 + 0.2;
        const rotation = time * 2 + i;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.globalAlpha = alpha;

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
            const a = (j / 5) * Math.PI * 2 - Math.PI / 2;
            const r = size * 0.6;
            const px = Math.cos(a) * r;
            const py = Math.sin(a) * r;
            if (j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    ctx.globalAlpha = 1;
}

function lightenColor(color: string, amount: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * amount));
    const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
    const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function darkenColor(color: string, amount: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.max(0, ((num >> 16) & 0xff) - Math.round(255 * amount));
    const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * amount));
    const b = Math.max(0, (num & 0xff) - Math.round(255 * amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

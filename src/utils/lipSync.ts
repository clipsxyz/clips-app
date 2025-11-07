/**
 * Lip Sync Utilities
 * Analyzes audio to determine mouth shapes for lip-syncing
 */

export type MouthShape = 'closed' | 'open' | 'smile' | 'oh' | 'f' | 'th';

/**
 * Analyze audio buffer to determine mouth shape
 */
export function analyzeMouthShape(
    audioBuffer: AudioBuffer,
    currentTime: number,
    windowSize: number = 0.1
): MouthShape {
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);
    const startSample = Math.floor(currentTime * sampleRate);
    const endSample = Math.min(
        Math.floor((currentTime + windowSize) * sampleRate),
        channelData.length
    );

    if (startSample >= endSample) return 'closed';

    // Extract audio features
    let sum = 0;
    let sumSq = 0;
    let peak = 0;
    let zeroCrossings = 0;
    let prevSign = channelData[startSample] >= 0;

    for (let i = startSample; i < endSample; i++) {
        const sample = channelData[i];
        const abs = Math.abs(sample);
        sum += abs;
        sumSq += abs * abs;
        if (abs > peak) peak = abs;

        const currentSign = sample >= 0;
        if (currentSign !== prevSign) {
            zeroCrossings++;
            prevSign = currentSign;
        }
    }

    const samples = endSample - startSample;
    const averageVolume = sum / samples;
    const variance = (sumSq / samples) - (averageVolume * averageVolume);
    const zeroCrossingRate = zeroCrossings / samples;

    // Determine mouth shape based on audio characteristics
    if (averageVolume < 0.05) {
        return 'closed';
    }

    // High zero crossing rate = fricatives (f, th sounds)
    if (zeroCrossingRate > 0.15 && averageVolume > 0.1) {
        if (variance > 0.02) {
            return 'f'; // f sound
        } else {
            return 'th'; // th sound
        }
    }

    // High volume with low variance = vowels (oh, open)
    if (averageVolume > 0.2 && variance < 0.01) {
        if (peak > 0.4) {
            return 'oh'; // O sound
        } else {
            return 'open'; // A, E sounds
        }
    }

    // Moderate volume with some variance = smile (happy sounds)
    if (averageVolume > 0.15 && variance < 0.015) {
        return 'smile';
    }

    // Default to open for speech
    if (averageVolume > 0.1) {
        return 'open';
    }

    return 'closed';
}

/**
 * Get mouth shape over time for animation
 */
export function getMouthShapesOverTime(
    audioBuffer: AudioBuffer,
    duration: number,
    fps: number = 30
): Array<{ time: number; shape: MouthShape }> {
    const shapes: Array<{ time: number; shape: MouthShape }> = [];
    const frameTime = 1 / fps;

    for (let time = 0; time < duration; time += frameTime) {
        const shape = analyzeMouthShape(audioBuffer, time);
        shapes.push({ time, shape });
    }

    return shapes;
}



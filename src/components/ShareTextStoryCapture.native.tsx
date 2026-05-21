import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import { TEXT_POST_BODY_MAX_LENGTH } from '../constants';

export type ShareTextStoryCaptureHandle = {
    capture: (text: string) => Promise<string>;
};

function wrapTextLines(text: string, maxCharsPerLine = 28, maxLines = 10): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (test.length > maxCharsPerLine) {
            if (line) lines.push(line);
            line = w;
        } else {
            line = test;
        }
        if (lines.length >= maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    return lines.length ? lines : ['Shared from the feed'];
}

const ShareTextStoryCapture = forwardRef<ShareTextStoryCaptureHandle>(function ShareTextStoryCapture(
    _props,
    ref,
) {
    const viewRef = useRef<View>(null);
    const [lines, setLines] = useState<string[]>(['']);

    useImperativeHandle(ref, () => ({
        async capture(text: string) {
            const safe = (text || 'Shared from the feed').slice(0, TEXT_POST_BODY_MAX_LENGTH);
            setLines(wrapTextLines(safe));
            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => setTimeout(resolve, 80));
            });
            if (!viewRef.current) {
                throw new Error('Share text canvas not ready');
            }
            const uri = await captureRef(viewRef, {
                format: 'png',
                quality: 1,
                result: 'tmpfile',
                width: 1080,
                height: 1920,
            });
            if (uri.startsWith('file://') || uri.startsWith('content://')) {
                return uri;
            }
            return `file://${uri}`;
        },
    }));

    return (
        <View style={styles.offscreen} pointerEvents="none">
            <View ref={viewRef} collapsable={false} style={styles.canvas}>
                <LinearGradient
                    colors={['#0ea5e9', '#8b5cf6', '#f43f5e']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.textBlock}>
                    {lines.map((ln, i) => (
                        <Text key={`${i}-${ln}`} style={styles.line}>
                            {ln}
                        </Text>
                    ))}
                </View>
            </View>
        </View>
    );
});

export default ShareTextStoryCapture;

const styles = StyleSheet.create({
    offscreen: {
        position: 'absolute',
        left: -12000,
        top: 0,
        opacity: 0,
    },
    canvas: {
        width: 1080,
        height: 1920,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    textBlock: {
        paddingHorizontal: 96,
        alignItems: 'center',
    },
    line: {
        color: '#FFFFFF',
        fontSize: 64,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 86,
    },
});

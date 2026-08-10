import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

type Props = {
    isFromMe: boolean;
    tailBackgroundColor: string;
    bubbleStyle?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    showTail?: boolean;
    /** `feed`: content-width news card (web TextCard). `dm`: messages thread. */
    layout?: 'dm' | 'feed';
    /** When set, bubble uses LinearGradient instead of solid fill. */
    gradientColors?: string[];
};

const IG_RADIUS = 18;
const IG_TAIL_RADIUS = 4;

/**
 * DM: Instagram-style bubble (asymmetric bottom corner, no speech tail).
 * Feed: legacy iMessage-style card with optional triangle tail.
 */
export default function IMessageDmBubbleShell({
    isFromMe,
    tailBackgroundColor,
    bubbleStyle,
    children,
    showTail = true,
    layout = 'dm',
    gradientColors,
}: Props) {
    const feedBubble = layout === 'feed';
    const useGradient = Boolean(gradientColors && gradientColors.length >= 2);
    const igCorners = feedBubble
        ? null
        : isFromMe
          ? {
                borderTopLeftRadius: IG_RADIUS,
                borderTopRightRadius: IG_RADIUS,
                borderBottomLeftRadius: IG_RADIUS,
                borderBottomRightRadius: IG_TAIL_RADIUS,
            }
          : {
                borderTopLeftRadius: IG_RADIUS,
                borderTopRightRadius: IG_RADIUS,
                borderBottomRightRadius: IG_RADIUS,
                borderBottomLeftRadius: IG_TAIL_RADIUS,
            };

    const bubbleStyles = [
        styles.bubble,
        feedBubble ? styles.bubbleFeed : styles.bubbleDm,
        igCorners,
        !useGradient ? { backgroundColor: tailBackgroundColor } : null,
        bubbleStyle,
    ];

    const bubbleContent = useGradient ? (
        <LinearGradient
            colors={gradientColors!}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={bubbleStyles}
        >
            {children}
        </LinearGradient>
    ) : (
        <View style={bubbleStyles}>{children}</View>
    );

    const useIMessageTail = feedBubble && showTail;

    return (
        <View style={[styles.outer, isFromMe ? styles.outerMe : styles.outerOther]}>
            {useIMessageTail ? (
                <View
                    pointerEvents="none"
                    style={[
                        styles.tail,
                        isFromMe ? styles.tailMe : styles.tailOther,
                        isFromMe
                            ? {
                                  borderLeftColor: tailBackgroundColor,
                              }
                            : {
                                  borderRightColor: tailBackgroundColor,
                              },
                    ]}
                />
            ) : null}
            {bubbleContent}
        </View>
    );
}

const styles = StyleSheet.create({
    outer: {
        position: 'relative',
        flexShrink: 1,
        maxWidth: '100%',
    },
    outerMe: {
        alignSelf: 'flex-end',
    },
    outerOther: {
        alignSelf: 'flex-start',
    },
    tail: {
        position: 'absolute',
        bottom: 10,
        width: 0,
        height: 0,
        borderTopWidth: 6,
        borderBottomWidth: 6,
        zIndex: 5,
    },
    tailMe: {
        right: -8,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftWidth: 9,
        borderRightWidth: 0,
    },
    tailOther: {
        left: -8,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderRightWidth: 9,
        borderLeftWidth: 0,
    },
    bubble: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        position: 'relative',
        overflow: 'hidden',
        alignSelf: 'flex-start',
        maxWidth: '100%',
    },
    bubbleDm: {
        // Instagram: flat, no iMessage drop shadow
        shadowOpacity: 0,
        elevation: 0,
    },
    bubbleFeed: {
        borderRadius: 16,
        paddingTop: 14,
        paddingBottom: 12,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'visible',
    },
});

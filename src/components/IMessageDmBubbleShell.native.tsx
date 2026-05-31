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

/**
 * iMessage-style bubble with bottom tail (feed + messages).
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
    const bubbleStyles = [
        styles.bubble,
        feedBubble ? styles.bubbleFeed : null,
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

    return (
        <View style={[styles.outer, isFromMe ? styles.outerMe : styles.outerOther]}>
            {showTail ? (
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
        borderRadius: 19,
        paddingHorizontal: 16,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.35,
        shadowRadius: 2,
        elevation: 2,
        overflow: 'visible',
    },
    bubbleFeed: {
        borderRadius: 16,
        paddingTop: 14,
        paddingBottom: 12,
        paddingHorizontal: 16,
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
});

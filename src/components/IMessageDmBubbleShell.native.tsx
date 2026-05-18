import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
    isFromMe: boolean;
    tailBackgroundColor: string;
    bubbleStyle?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    showTail?: boolean;
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
}: Props) {
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
            <View style={[styles.bubble, { backgroundColor: tailBackgroundColor }, bubbleStyle]}>{children}</View>
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
});

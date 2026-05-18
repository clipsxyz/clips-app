import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Post } from '../types';
import { getEffectiveTextStyleForPost } from '../utils/effectiveTextPostStyle';
import {
    getTextOnlyBackgroundColor,
    getTextOnlyFontSize,
    getTextOnlyTextColor,
} from '../utils/effectiveTextPostStyleNative';
import {
    formatTextOnlyFeedByline,
    isLikelyLightTextColor,
    resolveTextCardTailFill,
} from '../utils/feedTextBubble';
import IMessageDmBubbleShell from './IMessageDmBubbleShell.native';

type Props = {
    post: Post;
    isFromViewer: boolean;
    onDoubleLike: () => void;
    width: number;
};

export default function FeedTextOnlyCard({ post, isFromViewer, onDoubleLike, width }: Props) {
    const [expanded, setExpanded] = useState(false);
    const lastTapRef = useRef(0);
    const text = post.text?.trim() || '';
    const shouldTruncate = text.length > 100;
    const displayText = shouldTruncate && !expanded ? `${text.slice(0, 100)}…` : text;

    const effectiveStyle = useMemo(() => getEffectiveTextStyleForPost(post), [post]);
    const backgroundColor = getTextOnlyBackgroundColor(post);
    const textColor = getTextOnlyTextColor(post);
    const fontSize = getTextOnlyFontSize(post);
    const tailColor = resolveTextCardTailFill(
        effectiveStyle?.background || backgroundColor,
        isFromViewer
    );

    const bylineRaw =
        post.isReclipped && post.originalUserHandle && isFromViewer && post.userReclipped
            ? post.originalUserHandle
            : post.userHandle;
    const byline = formatTextOnlyFeedByline(bylineRaw, post.locationLabel);
    const bylineColor = isLikelyLightTextColor(textColor)
        ? 'rgba(15, 23, 42, 0.92)'
        : 'rgba(30, 41, 55, 0.9)';

    const handlePress = () => {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
            if (!post.userLiked) {
                onDoubleLike();
            }
            lastTapRef.current = 0;
            return;
        }
        lastTapRef.current = now;
    };

    return (
        <View style={[styles.wrap, { width }, isFromViewer ? styles.alignEnd : styles.alignStart]}>
            <Pressable onPress={handlePress}>
                <IMessageDmBubbleShell
                    isFromMe={isFromViewer}
                    tailBackgroundColor={tailColor}
                    bubbleStyle={{ backgroundColor, maxWidth: width * 0.92 }}
                >
                    {byline ? (
                        <Text style={[styles.byline, { color: bylineColor }]} numberOfLines={2}>
                            {byline.toUpperCase()}
                        </Text>
                    ) : null}
                    <Text
                        style={[
                            styles.body,
                            {
                                color: textColor,
                                fontSize,
                                fontFamily: effectiveStyle?.fontFamily,
                            },
                        ]}
                    >
                        {displayText}
                    </Text>
                    {shouldTruncate ? (
                        <Pressable
                            onPress={(e) => {
                                e.stopPropagation?.();
                                setExpanded((v) => !v);
                            }}
                            hitSlop={8}
                        >
                            <Text style={[styles.more, { color: textColor }]}>
                                {expanded ? 'Show less' : 'Show more'}
                            </Text>
                        </Pressable>
                    ) : null}
                </IMessageDmBubbleShell>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        marginTop: 4,
        paddingHorizontal: 4,
    },
    alignEnd: {
        alignItems: 'flex-end',
    },
    alignStart: {
        alignItems: 'flex-start',
    },
    byline: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.2,
        marginBottom: 8,
    },
    body: {
        fontWeight: '600',
        lineHeight: 22,
    },
    more: {
        marginTop: 8,
        fontSize: 13,
        fontWeight: '600',
        textDecorationLine: 'underline',
        opacity: 0.9,
    },
});

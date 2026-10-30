import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Avatar from './Avatar.native';
import { useHasUnseenStory } from '../hooks/useHasActiveStories';
import {
    STORY_GRADIENT_RING_COLORS,
    STORY_GRADIENT_RING_END,
    STORY_GRADIENT_RING_START,
    STORY_RING_GAP,
    STORY_RING_WIDTH,
} from '../utils/storyRingNative';

type Props = {
    handle: string;
    src?: string;
    name: string;
    size: number;
    viewerId?: string;
    isCurrentUser?: boolean;
    initialUnseen?: boolean;
    /** Inbox rows skip the per-row network probe and use `initialUnseen` + the viewed store. */
    probe?: boolean;
    onPress?: (hasUnseenStory: boolean) => void;
    onHasStoryChange?: (hasStory: boolean) => void;
};

/**
 * Shared profile photo + Instagram unseen gradient. Seen / no-story authors
 * render a clean avatar with no ring so feed headers and inbox threads match.
 */
export default function StoryRingAvatar({
    handle,
    src,
    name,
    size,
    viewerId,
    isCurrentUser,
    initialUnseen,
    probe = true,
    onPress,
    onHasStoryChange,
}: Props) {
    const hasUnseenStory = useHasUnseenStory(handle, {
        viewerId,
        isCurrentUser,
        initialUnseen,
        enabled: probe,
        onHasStoryChange,
    });

    const photo = (
        <Avatar src={src} name={name} size={hasUnseenStory ? size - (STORY_RING_WIDTH + STORY_RING_GAP) * 2 : size} hideBorder />
    );

    const body = hasUnseenStory ? (
        <LinearGradient
            colors={[...STORY_GRADIENT_RING_COLORS]}
            start={STORY_GRADIENT_RING_START}
            end={STORY_GRADIENT_RING_END}
            style={[styles.ring, { width: size, height: size, borderRadius: size / 2, padding: STORY_RING_WIDTH }]}
        >
            <View
                style={[
                    styles.ringInner,
                    {
                        borderRadius: size / 2,
                        padding: STORY_RING_GAP,
                    },
                ]}
            >
                {photo}
            </View>
        </LinearGradient>
    ) : (
        photo
    );

    if (!onPress) return body;

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onPress(hasUnseenStory)}
            accessibilityRole="button"
            accessibilityLabel={hasUnseenStory ? `View ${name} stories` : `View ${name} profile`}
        >
            {body}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    ring: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringInner: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
});

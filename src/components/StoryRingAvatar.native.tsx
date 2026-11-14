import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Avatar from './Avatar.native';
import { useHasUnseenStory } from '../hooks/useHasActiveStories';
import { STORY_RING_GAP, STORY_RING_UNSEEN_COLOR, STORY_RING_WIDTH } from '../utils/storyRingNative';

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
 * Profile photo with a thin white ring when there is an unviewed story.
 * The gap inside the ring stays clear so the surface behind the photo shows through.
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

    const photoSize = hasUnseenStory ? size - (STORY_RING_WIDTH + STORY_RING_GAP) * 2 : size;
    const photo = <Avatar src={src} name={name} size={photoSize} hideBorder />;

    // Border draws the white ring. The padding is the gap, left clear so the
    // card or media behind the photo shows through.
    const body = hasUnseenStory ? (
        <View
            style={[
                styles.ring,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: STORY_RING_WIDTH,
                    padding: STORY_RING_GAP,
                },
            ]}
        >
            {photo}
        </View>
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
        backgroundColor: 'transparent',
        borderColor: STORY_RING_UNSEEN_COLOR,
    },
});

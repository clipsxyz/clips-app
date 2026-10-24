import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from './Avatar';
import {
    DEFAULT_PROFILE_COVER_SOURCE,
    hasCustomProfileCover,
    resolveProfileCoverSource,
} from '../utils/profileCoverNative';
import {
    storyRingColor,
    storyRingVisible,
    type StoryRingState,
} from '../utils/storyRingNative';
import { UEFA_GLASS_BG, UEFA_GLASS_BORDER } from '../theme/gazetteerAmbientNative';

type Props = {
    coverUrl?: string | null;
    avatarUrl?: string;
    name?: string;
    hasStory?: boolean;
    /**
     * Three-state story ring (unseen white / seen grey / none). When provided it drives
     * the ring color; otherwise the ring falls back to `hasStory`.
     */
    storyRingState?: StoryRingState;
    onAvatarPress?: () => void;
    showChangeCover?: boolean;
    onPressChangeCover?: () => void;
    children?: React.ReactNode;
};

/** Background-colored standoff between the profile photo and its story ring. */
const PROFILE_AVATAR_RING_GAP = 3;
const PROFILE_AVATAR_GAP_COLOR = '#020B26';


export default function ProfileCoverHero({
    coverUrl,
    avatarUrl,
    name,
    hasStory,
    storyRingState,
    onAvatarPress,
    showChangeCover,
    onPressChangeCover,
    children,
}: Props) {
    const customCover = hasCustomProfileCover(coverUrl);
    const [coverFailed, setCoverFailed] = useState(false);
    const coverSource = coverFailed
        ? DEFAULT_PROFILE_COVER_SOURCE
        : resolveProfileCoverSource(coverUrl);

    useEffect(() => {
        setCoverFailed(false);
    }, [coverUrl]);

    const showMuted = !customCover || coverFailed;

    // Prefer the explicit three-state ring; fall back to the legacy boolean when the
    // caller only knows "has any story".
    const ringVisible = storyRingState
        ? storyRingVisible(storyRingState)
        : !!hasStory;
    const ringColor = storyRingState ? storyRingColor(storyRingState) : undefined;
    const ringGap = ringVisible ? PROFILE_AVATAR_RING_GAP : 0;
    const avatarProps = {
        src: avatarUrl,
        name: name || 'User',
        size: 88 as const,
        hasStory,
        ringGap,
        gapColor: PROFILE_AVATAR_GAP_COLOR,
        ringColor,
        hideBorder: !ringVisible,
    };

    return (
        <View style={styles.wrap}>
            <Image
                source={coverSource}
                style={[styles.coverImage, showMuted && styles.coverImageMuted]}
                resizeMode="cover"
                onError={() => {
                    if (customCover) setCoverFailed(true);
                }}
            />
            <LinearGradient
                colors={['rgba(10,25,78,0.25)', 'rgba(0,56,209,0.35)', 'rgba(2,11,38,0.85)']}
                style={styles.gradient}
                pointerEvents="none"
            />
            {showChangeCover && onPressChangeCover ? (
                <TouchableOpacity style={styles.changeCoverBtn} onPress={onPressChangeCover}>
                    <Icon name="image-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.changeCoverText}>Change cover</Text>
                </TouchableOpacity>
            ) : null}
            <View style={styles.centerBlock}>
                <View style={styles.identityStack}>
                    {onAvatarPress ? (
                        <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.85}>
                            <View style={styles.avatarGlowWrap}>
                                <Avatar {...avatarProps} ringColor={ringVisible ? '#FFFFFF' : ringColor} />
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.avatarGlowWrap}>
                            <Avatar {...avatarProps} ringColor={ringVisible ? '#FFFFFF' : ringColor} />
                        </View>
                    )}
                    {children}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        height: 260,
        borderRadius: 20,
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        backgroundColor: '#020B26',
        position: 'relative',
        shadowColor: '#FFFFFF',
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
    },
    avatarGlowWrap: {
        shadowColor: '#FFFFFF',
        shadowOpacity: 0.5,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 10,
        borderRadius: 999,
    },
    coverImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
    },
    coverImageMuted: {
        opacity: 0.55,
    },
    gradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
    },
    changeCoverBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 4,
        elevation: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: UEFA_GLASS_BG,
        borderWidth: 1,
        borderColor: UEFA_GLASS_BORDER,
    },
    changeCoverText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    centerBlock: {
        flex: 1,
        zIndex: 3,
        elevation: 3,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    identityStack: {
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: '100%',
    },
});

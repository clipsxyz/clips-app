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

type Props = {
    coverUrl?: string | null;
    avatarUrl?: string;
    handle?: string;
    name?: string;
    hasStory?: boolean;
    onAvatarPress?: () => void;
    showChangeCover?: boolean;
    onPressChangeCover?: () => void;
    children?: React.ReactNode;
};

export default function ProfileCoverHero({
    coverUrl,
    avatarUrl,
    handle,
    name,
    hasStory,
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
                colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.28)', 'rgba(11,7,17,0.75)']}
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
                            <Avatar src={avatarUrl} name={name || 'User'} handle={handle} size={88} hasStory={hasStory} />
                        </TouchableOpacity>
                    ) : (
                        <Avatar src={avatarUrl} name={name || 'User'} handle={handle} size={88} hasStory={hasStory} />
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
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: '#111827',
        position: 'relative',
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
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
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

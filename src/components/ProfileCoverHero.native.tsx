import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from './Avatar';
import { hasCustomProfileCover, resolveProfileCoverUri } from '../utils/profileCoverNative';

type Props = {
    coverUrl?: string | null;
    avatarUrl?: string;
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
    name,
    hasStory,
    onAvatarPress,
    showChangeCover,
    onPressChangeCover,
    children,
}: Props) {
    const customCover = hasCustomProfileCover(coverUrl);
    const [coverFailed, setCoverFailed] = useState(false);
    const coverSrc = coverFailed
        ? resolveProfileCoverUri(null)
        : resolveProfileCoverUri(coverUrl);

    useEffect(() => {
        setCoverFailed(false);
    }, [coverUrl]);

    const showMuted = !customCover || coverFailed;

    return (
        <View style={styles.wrap}>
            <Image
                source={{ uri: coverSrc }}
                style={[styles.coverImage, showMuted && styles.coverImageMuted]}
                resizeMode="cover"
                onError={() => setCoverFailed(true)}
            />
            <LinearGradient
                colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.45)', 'rgba(11,7,17,0.92)']}
                style={StyleSheet.absoluteFill}
            />
            {showChangeCover && onPressChangeCover ? (
                <TouchableOpacity style={styles.changeCoverBtn} onPress={onPressChangeCover}>
                    <Icon name="image-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.changeCoverText}>Change cover</Text>
                </TouchableOpacity>
            ) : null}
            <View style={styles.centerBlock}>
                {onAvatarPress ? (
                    <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.85}>
                        <Avatar src={avatarUrl} name={name || 'User'} size={88} hasStory={hasStory} />
                    </TouchableOpacity>
                ) : (
                    <Avatar src={avatarUrl} name={name || 'User'} size={88} hasStory={hasStory} />
                )}
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        height: 220,
        borderRadius: 20,
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: '#111827',
    },
    coverImage: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    coverImageMuted: {
        opacity: 0.32,
    },
    changeCoverBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 3,
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
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 28,
        zIndex: 2,
    },
});

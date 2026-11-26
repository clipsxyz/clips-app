import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../Avatar';
import { profileShareDisplayName } from '../../utils/profileShareStory';

type Props = {
    handle: string;
    avatarUrl?: string;
    /** Person who shared this profile into Shorts. */
    sharerName?: string;
    onViewProfile?: (handle: string) => void;
};

/** Profile shared into Stories 24: portrait, name, and a way into the profile. */
export default function StoryProfileShareCard({ handle, avatarUrl, sharerName, onViewProfile }: Props) {
    const name = profileShareDisplayName(handle);
    const handleLabel = handle.replace(/^@/, '');
    const sharerHandle = (sharerName || '').trim();
    const sharer = sharerHandle ? profileShareDisplayName(sharerHandle) : '';
    const kicker = sharer ? `${sharer} says check out` : 'Check out';
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    return (
        <LinearGradient
            colors={['#03091B', '#071330', '#160830', '#0A051C']}
            locations={[0, 0.42, 0.78, 1]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[styles.fill, { width, height, paddingTop: insets.top + 88, paddingBottom: insets.bottom + 108 }]}
        >
            <Text style={styles.kicker}>{kicker}</Text>
            <LinearGradient
                colors={['#22C55E', '#FFD400', '#FF4D9A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ring}
            >
                <View style={styles.ringGap}>
                    <Avatar src={avatarUrl} name={name} size={120} hideBorder />
                </View>
            </LinearGradient>
            <Text style={styles.name} numberOfLines={1}>
                {name}
            </Text>
            <Text style={styles.handle} numberOfLines={1}>
                {handleLabel}
            </Text>
            <Pressable
                style={styles.button}
                onPress={() => onViewProfile?.(handle)}
                accessibilityRole="button"
                accessibilityLabel="View profile"
            >
                <Text style={styles.buttonText}>View profile</Text>
            </Pressable>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    fill: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    kicker: {
        marginBottom: 24,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        textAlign: 'center',
        color: '#FFFFFF',
    },
    ring: {
        width: 132,
        height: 132,
        borderRadius: 66,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringGap: {
        width: 126,
        height: 126,
        borderRadius: 63,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#03091B',
    },
    name: {
        marginTop: 20,
        maxWidth: '100%',
        fontSize: 26,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    handle: {
        marginTop: 4,
        maxWidth: '100%',
        fontSize: 15,
        color: '#E2E8F0',
        textAlign: 'center',
    },
    button: {
        marginTop: 32,
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 32,
        paddingVertical: 14,
    },
    buttonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#03091B',
    },
});

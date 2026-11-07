import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/Auth';
import { resolvePublicMediaUrl } from '../api/apiBaseUrl';
import {
    FEED_HEADER_PASSPORT_AVATAR,
    FEED_HEADER_PASSPORT_AVATAR_RING,
    FEED_HEADER_PASSPORT_INITIALS,
    FEED_HEADER_SIDE_ACTION,
    FEED_HEADER_SIDE_LABEL,
} from './FeedPageLayout.native';

type Props = {
    onPress: () => void;
};

/**
 * Feed header passport. A failed image request only hides the picture for this
 * mount. It does not clear the cached user.
 */
export default function HeaderPassportButton({ onPress }: Props) {
    const { user } = useAuth();
    const avatarUrl = String(
        user?.avatarUrl || (user as { avatar_url?: string } | null)?.avatar_url || '',
    ).trim();
    const [imageError, setImageError] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        setImageError(false);
        setAttempt(0);
    }, [avatarUrl]);

    const hasValidAvatar = Boolean(avatarUrl) && !imageError;
    const userInitial = user?.name?.trim() ? user.name.trim().charAt(0).toUpperCase() : 'P';
    const uri = hasValidAvatar ? resolvePublicMediaUrl(avatarUrl) || avatarUrl : '';

    return (
        <TouchableOpacity
            onPress={onPress}
            style={FEED_HEADER_SIDE_ACTION}
            accessibilityLabel="My Passport"
        >
            <View style={styles.wrap}>
                <View style={FEED_HEADER_PASSPORT_AVATAR}>
                    {hasValidAvatar ? (
                        <Image
                            key={`${uri}:${attempt}`}
                            source={{ uri }}
                            style={styles.image}
                            onError={() => {
                                // Metro reload often aborts the first request. Try once more
                                // before falling back to the letter.
                                if (attempt < 1) {
                                    setAttempt((current) => current + 1);
                                    return;
                                }
                                setImageError(true);
                            }}
                        />
                    ) : (
                        <Text style={FEED_HEADER_PASSPORT_INITIALS}>{userInitial}</Text>
                    )}
                    <View pointerEvents="none" style={FEED_HEADER_PASSPORT_AVATAR_RING} />
                </View>
                <Text style={FEED_HEADER_SIDE_LABEL}>Passport</Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
    },
});

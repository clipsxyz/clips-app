import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type Props = {
    isFollowing: boolean;
    isRequested?: boolean;
    followLoading: boolean;
    isOwnStory: boolean;
    onViewProfile: () => void;
    onToggleFollow: () => void;
    onClose: () => void;
};

export default function StoryProfileCard({
    isFollowing,
    isRequested = false,
    followLoading,
    isOwnStory,
    onViewProfile,
    onToggleFollow,
    onClose,
}: Props) {
    const followLabel = isFollowing ? 'Following' : isRequested ? 'Requested' : 'Follow';

    return (
        <View style={styles.wrap}>
            <TouchableOpacity style={styles.row} onPress={onViewProfile}>
                <Text style={styles.rowText}>View profile</Text>
            </TouchableOpacity>
            {!isOwnStory ? (
                <TouchableOpacity style={styles.row} onPress={onToggleFollow} disabled={followLoading}>
                    {followLoading ? (
                        <ActivityIndicator color="#67e8f9" size="small" />
                    ) : (
                        <View style={styles.followRow}>
                            {isFollowing ? (
                                <Icon name="checkmark" size={16} color="#67e8f9" />
                            ) : null}
                            <Text style={styles.followText}>{followLabel}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.row} onPress={onClose}>
                <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        width: 220,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(0,0,0,0.72)',
        overflow: 'hidden',
    },
    row: {
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    rowText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    followRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    followText: { color: '#67e8f9', fontSize: 14, fontWeight: '600' },
    closeText: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
});

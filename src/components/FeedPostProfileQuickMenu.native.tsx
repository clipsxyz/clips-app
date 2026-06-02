import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { glassPanel } from '../theme/gazetteerAmbientNative';

export type FeedPostProfileQuickMenuProps = {
    visible: boolean;
    profileHandle: string;
    isCurrentUser: boolean;
    isMutualFollow: boolean;
    hasStory: boolean;
    isFollowing: boolean;
    onClose: () => void;
    onVisitProfile: () => void;
    onFollow?: () => Promise<void>;
    onViewStories?: () => void;
    onMessage?: () => void;
    onBlock?: () => Promise<void>;
    onReport?: () => Promise<void>;
};

/** Web PostHeader quick-actions menu (Visit profile / Follow / Stories / DM / Block / Report). */
export default function FeedPostProfileQuickMenu({
    visible,
    isCurrentUser,
    isMutualFollow,
    hasStory,
    isFollowing,
    onClose,
    onVisitProfile,
    onFollow,
    onViewStories,
    onMessage,
    onBlock,
    onReport,
}: FeedPostProfileQuickMenuProps) {
    if (!visible) return null;

    return (
        <View style={styles.card}>
            <TouchableOpacity
                style={styles.item}
                onPress={() => {
                    onClose();
                    onVisitProfile();
                }}
            >
                <Icon name="person-outline" size={18} color="#FFFFFF" />
                <Text style={styles.itemText}>Visit profile</Text>
            </TouchableOpacity>

            {!isCurrentUser && onFollow ? (
                <TouchableOpacity
                    style={styles.item}
                    onPress={async () => {
                        onClose();
                        await onFollow();
                    }}
                >
                    <Icon
                        name={isFollowing ? 'person-remove-outline' : 'person-add-outline'}
                        size={18}
                        color="#FFFFFF"
                    />
                    <Text style={styles.itemText}>{isFollowing ? 'Unfollow' : 'Follow'}</Text>
                </TouchableOpacity>
            ) : null}

            {onViewStories && hasStory ? (
                <TouchableOpacity
                    style={styles.item}
                    onPress={() => {
                        onClose();
                        onViewStories();
                    }}
                >
                    <Icon name="play-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.itemText}>View stories</Text>
                </TouchableOpacity>
            ) : null}

            {!isCurrentUser && isMutualFollow && onMessage ? (
                <TouchableOpacity
                    style={styles.item}
                    onPress={() => {
                        onClose();
                        onMessage();
                    }}
                >
                    <Icon name="chatbubble-outline" size={18} color="#67E8F9" />
                    <Text style={[styles.itemText, styles.itemTextMessage]}>Message</Text>
                </TouchableOpacity>
            ) : null}

            {!isCurrentUser && onBlock ? (
                <TouchableOpacity
                    style={styles.item}
                    onPress={async () => {
                        onClose();
                        await onBlock();
                    }}
                >
                    <Icon name="ban-outline" size={18} color="#FCA5A5" />
                    <Text style={[styles.itemText, styles.itemTextBlock]}>Block user</Text>
                </TouchableOpacity>
            ) : null}

            {!isCurrentUser && onReport ? (
                <TouchableOpacity
                    style={styles.item}
                    onPress={async () => {
                        onClose();
                        await onReport();
                    }}
                >
                    <Icon name="flag-outline" size={18} color="#FDE68A" />
                    <Text style={[styles.itemText, styles.itemTextReport]}>Report</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginTop: 60,
        marginLeft: 16,
        borderRadius: 12,
        paddingVertical: 4,
        minWidth: 170,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 12,
        ...glassPanel,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        columnGap: 8,
    },
    itemText: {
        fontSize: 14,
        color: '#F9FAFB',
        fontWeight: '500',
    },
    itemTextMessage: {
        color: '#A5F3FC',
    },
    itemTextBlock: {
        color: '#FCA5A5',
    },
    itemTextReport: {
        color: '#FDE68A',
    },
});

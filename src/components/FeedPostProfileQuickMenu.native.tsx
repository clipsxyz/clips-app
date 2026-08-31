import React from 'react';
import {
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import DiscoverAmbientCanvas from './DiscoverAmbientCanvas.native';
import { PASSPORT_ABYSS, PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';

/** Stronger wash for short sheets — flat #060d16 reads as unchanged black on Android. */
const PASSPORT_WASH = ['#060d16', '#0f3a42', '#1f6b63', '#164858', '#060d16'] as const;

export type ProfileQuickMenuAnchor = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type FeedPostProfileQuickMenuProps = {
    visible: boolean;
    anchor?: ProfileQuickMenuAnchor | null;
    profileHandle: string;
    isCurrentUser: boolean;
    isMutualFollow: boolean;
    hasStory: boolean;
    isFollowing: boolean;
    isRequested?: boolean;
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
    anchor,
    isCurrentUser,
    isMutualFollow,
    hasStory,
    isFollowing,
    isRequested = false,
    onClose,
    onVisitProfile,
    onFollow,
    onViewStories,
    onMessage,
    onBlock,
    onReport,
}: FeedPostProfileQuickMenuProps) {
    const insets = useSafeAreaInsets();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();

    if (!visible) return null;

    const menuWidth = 224;
    const menuLeft = anchor
        ? Math.min(Math.max(12, anchor.x), windowWidth - menuWidth - 12)
        : 16;
    const menuTop = anchor
        ? Math.min(anchor.y + anchor.height + 6, windowHeight - 320)
        : insets.top + 72;

    const menuBody = (
        <>
            <View style={styles.headerRow}>
                <Text style={styles.headerLabel}>Quick actions</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="close" size={18} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
            </View>

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
                        name={
                            isFollowing
                                ? 'person-remove-outline'
                                : isRequested
                                  ? 'time-outline'
                                  : 'person-add-outline'
                        }
                        size={18}
                        color="#FFFFFF"
                    />
                    <Text style={styles.itemText}>
                        {isFollowing ? 'Unfollow' : isRequested ? 'Requested' : 'Follow'}
                    </Text>
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
                    <Icon name="chatbubble-outline" size={18} color={PASSPORT_PALETTE.wavePrimary} />
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
        </>
    );

    const cardInner =
        Platform.OS === 'ios' ? (
            <View style={styles.cardCanvas} collapsable={false}>
                <View style={styles.ambientBack} pointerEvents="none" collapsable={false}>
                    <DiscoverAmbientCanvas variant="passport" fillParent />
                </View>
                <View style={styles.cardContent} collapsable={false}>
                    {menuBody}
                </View>
            </View>
        ) : (
            <LinearGradient
                colors={[...PASSPORT_WASH]}
                locations={[0, 0.28, 0.55, 0.78, 1]}
                start={{ x: 0.1, y: 1 }}
                end={{ x: 0.9, y: 0 }}
                style={styles.cardCanvas}
            >
                <View style={styles.cardContent} collapsable={false}>
                    {menuBody}
                </View>
            </LinearGradient>
        );

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable
                    style={[styles.card, { top: menuTop, left: menuLeft, width: menuWidth }]}
                    onPress={(e) => e.stopPropagation()}
                >
                    {cardInner}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    card: {
        position: 'absolute',
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: PASSPORT_ABYSS,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 12,
    },
    cardCanvas: {
        backgroundColor: PASSPORT_ABYSS,
        overflow: 'hidden',
    },
    ambientBack: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
    },
    cardContent: {
        position: 'relative',
        zIndex: 1,
        paddingVertical: 4,
        backgroundColor: 'transparent',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.12)',
    },
    headerLabel: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.6)',
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
        color: '#9fd4cb',
    },
    itemTextBlock: {
        color: '#FCA5A5',
    },
    itemTextReport: {
        color: '#FDE68A',
    },
});

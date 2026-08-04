import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
    BottomSheetFlatList,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import {
    fetchPostLikers,
    toggleFollowFromLikesSheet,
    type PostLiker,
} from '../api/postLikers';
import Avatar from './Avatar';
import FeedLikeThumbsIcon from './FeedLikeThumbsIcon.native';
import GazetteerBottomSheetModal, { GAZETTEER_SHEET_DARK } from './GazetteerBottomSheetModal.native';

type Props = {
    visible: boolean;
    postId: string;
    userId: string;
    viewerHandle?: string | null;
    likeCount: number;
    viewCount?: number;
    onClose: () => void;
    onVisitProfile?: (handle: string) => void;
};

/** Web EngagementBar likes sheet — App.tsx `Likes and plays` + @gorhom/bottom-sheet. */
export default function FeedLikesSheet({
    visible,
    postId,
    userId,
    viewerHandle,
    likeCount,
    viewCount = 0,
    onClose,
    onVisitProfile,
}: Props) {
    const [likers, setLikers] = useState<PostLiker[]>([]);
    const [sheetLikes, setSheetLikes] = useState(likeCount);
    const [sheetViews, setSheetViews] = useState(viewCount);
    const [following, setFollowing] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!visible || likeCount <= 0) {
            setLikers([]);
            setFollowing(new Set());
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        fetchPostLikers(postId, userId, likeCount, viewCount)
            .then((result) => {
                if (cancelled) return;
                setLikers(result.items);
                setSheetLikes(result.likes_count);
                setSheetViews(result.views_count);
                const next = new Set<string>();
                result.items.forEach((row) => {
                    if (row.is_following) next.add(row.handle);
                });
                setFollowing(next);
            })
            .catch(() => {
                if (!cancelled) {
                    setLikers([]);
                    setSheetLikes(likeCount);
                    setSheetViews(viewCount);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [visible, postId, userId, likeCount, viewCount]);

    const toggleFollow = useCallback(
        async (handle: string) => {
            const next = !following.has(handle);
            setFollowing((prev) => {
                const copy = new Set(prev);
                if (next) copy.add(handle);
                else copy.delete(handle);
                return copy;
            });
            try {
                const result = await toggleFollowFromLikesSheet(userId, handle, next, viewerHandle || undefined);
                if (result.requested || !result.following) {
                    setFollowing((prev) => {
                        const copy = new Set(prev);
                        copy.delete(handle);
                        return copy;
                    });
                } else if (result.following) {
                    setFollowing((prev) => {
                        const copy = new Set(prev);
                        copy.add(handle);
                        return copy;
                    });
                }
            } catch {
                setFollowing((prev) => {
                    const copy = new Set(prev);
                    if (next) copy.delete(handle);
                    else copy.add(handle);
                    return copy;
                });
            }
        },
        [following, userId, viewerHandle],
    );

    const renderItem = useCallback(
        ({ item }: { item: PostLiker }) => {
            const isSelf =
                !!viewerHandle && item.handle.toLowerCase() === viewerHandle.toLowerCase();
            const isFollowing = following.has(item.handle);
            return (
                <View style={styles.row}>
                    <TouchableOpacity
                        style={styles.rowLeft}
                        onPress={() => {
                            onClose();
                            onVisitProfile?.(item.handle);
                        }}
                        disabled={!onVisitProfile}
                        activeOpacity={0.8}
                    >
                        <Avatar
                            src={item.avatar_url}
                            name={item.display_name || item.handle.split('@')[0]}
                            size="sm"
                        />
                        <View style={styles.nameCol}>
                            <Text style={styles.displayName} numberOfLines={1}>
                                {item.display_name || item.handle}
                            </Text>
                            {item.display_name ? (
                                <Text style={styles.subHandle} numberOfLines={1}>
                                    {item.handle}
                                </Text>
                            ) : null}
                        </View>
                    </TouchableOpacity>
                    {!isSelf ? (
                        <TouchableOpacity
                            style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                            onPress={() => void toggleFollow(item.handle)}
                        >
                            <Text
                                style={[
                                    styles.followBtnText,
                                    isFollowing && styles.followBtnTextActive,
                                ]}
                            >
                                {isFollowing ? 'Following' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            );
        },
        [following, onClose, onVisitProfile, toggleFollow, viewerHandle],
    );

    return (
        <GazetteerBottomSheetModal
            visible={visible}
            onDismiss={onClose}
            snapPoints={['70%']}
            backgroundStyle={GAZETTEER_SHEET_DARK.background}
            handleIndicatorStyle={GAZETTEER_SHEET_DARK.handle}
        >
            <BottomSheetView style={styles.sheetChrome}>
                <View style={styles.header}>
                    <Text style={styles.title}>Likes and plays</Text>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.closeBtn}
                        hitSlop={8}
                        accessibilityLabel="Close"
                    >
                        <Icon name="close" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.stat}>
                        <FeedLikeThumbsIcon size={16} color="#F472B6" />
                        <Text style={styles.statLabel}>Likes</Text>
                        <Text style={styles.statValue}>{sheetLikes.toLocaleString()}</Text>
                    </View>
                    <View style={styles.stat}>
                        <Icon name="eye-outline" size={16} color="#60A5FA" />
                        <Text style={styles.statLabel}>Views</Text>
                        <Text style={styles.statValue}>{sheetViews.toLocaleString()}</Text>
                    </View>
                </View>

                <View style={styles.listDivider} />
            </BottomSheetView>

            {loading ? (
                <BottomSheetView>
                    <Text style={styles.empty}>Loading…</Text>
                </BottomSheetView>
            ) : (
                <BottomSheetFlatList
                    data={likers}
                    keyExtractor={(item, index) => `${item.handle}-${index}`}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={<Text style={styles.empty}>No likes yet.</Text>}
                />
            )}
        </GazetteerBottomSheetModal>
    );
}

const styles = StyleSheet.create({
    sheetChrome: {
        paddingTop: 4,
        paddingHorizontal: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    title: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    closeBtn: {
        padding: 6,
        borderRadius: 999,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statLabel: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    statValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#E5E7EB',
    },
    listDivider: {
        marginHorizontal: -16,
        marginBottom: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    list: {
        paddingHorizontal: 16,
        paddingBottom: 8,
        paddingRight: 20,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        gap: 12,
    },
    rowLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
    },
    nameCol: {
        flex: 1,
        minWidth: 0,
    },
    displayName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#F3F4F6',
    },
    subHandle: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    followBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#3B82F6',
        borderWidth: 1,
        borderColor: '#60A5FA',
    },
    followBtnActive: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.2)',
    },
    followBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    followBtnTextActive: {
        color: '#E5E7EB',
    },
    empty: {
        textAlign: 'center',
        fontSize: 12,
        color: '#6B7280',
        paddingVertical: 32,
    },
});

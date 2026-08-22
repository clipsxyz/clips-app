import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import {
    fetchPostLikers,
    toggleFollowFromLikesSheet,
    type PostLiker,
} from '../api/postLikers';
import Avatar from './Avatar';
import FeedLikeThumbsIcon from './FeedLikeThumbsIcon.native';
import GazetteerBottomSheetModal, {
    GAZETTEER_SHEET_PASSPORT,
} from './GazetteerBottomSheetModal.native';
import PassportSheetCanvas from './PassportSheetCanvas.native';
import { PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';

const P = {
    text: '#e8eef2',
    muted: 'rgba(232, 238, 242, 0.62)',
    border: 'rgba(255,255,255,0.12)',
    chipBg: 'rgba(15, 36, 48, 0.72)',
    accent: PASSPORT_PALETTE.wavePrimary,
};

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

/** Feed likes & plays sheet — View Profile passport canvas. */
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
        if (!visible) {
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
                const result = await toggleFollowFromLikesSheet(
                    userId,
                    handle,
                    next,
                    viewerHandle || undefined,
                );
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

    const listHeader = useMemo(
        () => (
            <View style={styles.sheetChrome}>
                <View style={styles.header}>
                    <Text style={styles.title}>Likes and plays</Text>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.closeBtn}
                        hitSlop={8}
                        accessibilityLabel="Close"
                    >
                        <Icon name="close" size={16} color={P.muted} />
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
            </View>
        ),
        [onClose, sheetLikes, sheetViews],
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
            backgroundStyle={GAZETTEER_SHEET_PASSPORT.background}
            handleIndicatorStyle={GAZETTEER_SHEET_PASSPORT.handle}
        >
            <PassportSheetCanvas style={styles.canvas} contentStyle={styles.canvasContent}>
                {/*
                  Column layout (regular View, not BottomSheetView sibling) keeps chrome
                  pinned while FlatList scrolls below — avoids FlatList painting over header.
                */}
                <View style={styles.body}>
                    {listHeader}
                    <BottomSheetFlatList
                        style={styles.listFlex}
                        data={loading ? [] : likers}
                        keyExtractor={(item, index) => `${item.handle}-${index}`}
                        renderItem={renderItem}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <Text style={styles.empty}>
                                {loading ? 'Loading…' : 'No likes yet.'}
                            </Text>
                        }
                    />
                </View>
            </PassportSheetCanvas>
        </GazetteerBottomSheetModal>
    );
}

const styles = StyleSheet.create({
    canvas: {
        flex: 1,
    },
    canvasContent: {
        flex: 1,
    },
    body: {
        flex: 1,
    },
    sheetChrome: {
        zIndex: 2,
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 4,
        // Slight wash so list items never read through the pinned chrome on overscroll.
        backgroundColor: 'rgba(6, 13, 22, 0.94)',
    },
    listFlex: {
        flex: 1,
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
        color: P.muted,
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
        color: P.muted,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '600',
        color: P.text,
    },
    listDivider: {
        marginHorizontal: -16,
        marginBottom: 4,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: P.border,
    },
    list: {
        paddingHorizontal: 16,
        paddingBottom: 24,
        paddingTop: 4,
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
        color: P.text,
    },
    subHandle: {
        fontSize: 12,
        color: P.muted,
    },
    followBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(61,155,143,0.35)',
        borderWidth: 1,
        borderColor: 'rgba(61,155,143,0.55)',
    },
    followBtnActive: {
        backgroundColor: P.chipBg,
        borderColor: P.border,
    },
    followBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: P.text,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    followBtnTextActive: {
        color: P.muted,
    },
    empty: {
        textAlign: 'center',
        fontSize: 12,
        color: P.muted,
        paddingVertical: 32,
    },
});

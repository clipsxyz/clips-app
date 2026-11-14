import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomSheetFlatList, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import {
    fetchPostLikers,
    toggleFollowFromLikesSheet,
    type PostLiker,
} from '../api/postLikers';
import Avatar from './Avatar';
import GazetteerBottomSheetModal, {
    GAZETTEER_SHEET_INBOX,
} from './GazetteerBottomSheetModal.native';
import PassportSheetCanvas from './PassportSheetCanvas.native';

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
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!visible || likeCount <= 0) {
            setLikers([]);
            setFollowing(new Set());
            setLoading(false);
            setQuery('');
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

    const visibleLikers = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return likers;
        return likers.filter((row) => {
            const name = (row.display_name || '').toLowerCase();
            return row.handle.toLowerCase().includes(needle) || name.includes(needle);
        });
    }, [likers, query]);

    const renderItem = useCallback(
        ({ item }: { item: PostLiker }) => {
            const isSelf =
                !!viewerHandle && item.handle.toLowerCase() === viewerHandle.toLowerCase();
            const isFollowing = following.has(item.handle);
            const subtitle =
                item.display_name && item.display_name.trim().toLowerCase() !== item.handle.toLowerCase()
                    ? item.display_name
                    : '';
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
                            size={44}
                            hideBorder
                        />
                        <View style={styles.nameCol}>
                            <Text style={styles.displayName} numberOfLines={1}>
                                {item.handle}
                            </Text>
                            {subtitle ? (
                                <Text style={styles.subHandle} numberOfLines={1}>
                                    {subtitle}
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
            backgroundStyle={GAZETTEER_SHEET_INBOX.background}
            handleIndicatorStyle={GAZETTEER_SHEET_INBOX.handle}
        >
            <PassportSheetCanvas tone="ucl" style={styles.canvas} contentStyle={styles.canvasContent}>
                {/*
                  Column layout (regular View, not BottomSheetView sibling) keeps chrome
                  pinned while FlatList scrolls below — avoids FlatList painting over header.
                */}
                <View style={styles.body}>
                    <View style={styles.sheetChrome}>
                        <Text style={styles.title}>Reactions</Text>
                        <View style={styles.statsRow}>
                            <View style={styles.stat}>
                                <Icon name="heart-outline" size={18} color="#FFFFFF" />
                                <Text style={styles.statValue}>{sheetLikes.toLocaleString()}</Text>
                            </View>
                            <View style={styles.stat}>
                                <Icon name="eye-outline" size={18} color="#FFFFFF" />
                                <Text style={styles.statValue}>{sheetViews.toLocaleString()}</Text>
                            </View>
                        </View>
                        <View style={styles.listDivider} />
                        <Text style={styles.sectionTitle}>Liked by</Text>
                        <View style={styles.searchBox}>
                            <Icon name="search" size={16} color="#9CA3AF" />
                            <BottomSheetTextInput
                                value={query}
                                onChangeText={setQuery}
                                placeholder="Search"
                                placeholderTextColor="#9CA3AF"
                                style={styles.searchInput}
                                autoCorrect={false}
                                autoCapitalize="none"
                            />
                        </View>
                    </View>
                    <BottomSheetFlatList
                        style={styles.listFlex}
                        data={loading ? [] : visibleLikers}
                        keyExtractor={(item, index) => `${item.handle}-${index}`}
                        renderItem={renderItem}
                        contentContainerStyle={styles.list}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <Text style={styles.empty}>
                                {loading ? 'Loading…' : query.trim() ? 'No matches' : 'No likes yet.'}
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
        paddingTop: 2,
        paddingBottom: 8,
        backgroundColor: '#03091B',
    },
    listFlex: {
        flex: 1,
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        marginBottom: 14,
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    listDivider: {
        marginHorizontal: -16,
        marginBottom: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.12)',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 12,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 12,
        height: 40,
    },
    searchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 15,
        paddingVertical: 0,
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
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    subHandle: {
        marginTop: 1,
        fontSize: 13,
        color: '#9CA3AF',
    },
    followBtn: {
        minWidth: 96,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: '#3d9b8f',
        alignItems: 'center',
    },
    followBtnActive: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
    },
    followBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    followBtnTextActive: {
        color: '#FFFFFF',
    },
    empty: {
        textAlign: 'center',
        fontSize: 12,
        color: '#9CA3AF',
        paddingVertical: 32,
    },
});

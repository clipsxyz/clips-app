import React, { useCallback, useEffect, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    FlatList,
    Pressable,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
    fetchPostLikers,
    toggleFollowFromLikesSheet,
    type PostLiker,
} from '../api/postLikers';
import Avatar from './Avatar';

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
                await toggleFollowFromLikesSheet(userId, handle, next);
            } catch {
                setFollowing((prev) => {
                    const copy = new Set(prev);
                    if (next) copy.delete(handle);
                    else copy.add(handle);
                    return copy;
                });
            }
        },
        [following, userId],
    );

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.handleBar} />
                    <View style={styles.header}>
                        <Text style={styles.title}>Likes and views</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={8}>
                            <Icon name="close" size={22} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.stat}>
                            <Icon name="heart" size={16} color="#EF4444" />
                            <Text style={styles.statLabel}>Likes</Text>
                            <Text style={styles.statValue}>{sheetLikes.toLocaleString()}</Text>
                        </View>
                        <View style={styles.stat}>
                            <Icon name="eye-outline" size={16} color="#9CA3AF" />
                            <Text style={styles.statLabel}>Views</Text>
                            <Text style={styles.statValue}>{sheetViews.toLocaleString()}</Text>
                        </View>
                    </View>

                    {loading ? (
                        <ActivityIndicator color="#7A8AF0" style={styles.loader} />
                    ) : (
                        <FlatList
                            data={likers}
                            keyExtractor={(item, index) => `${item.handle}-${index}`}
                            contentContainerStyle={styles.list}
                            ListEmptyComponent={
                                <Text style={styles.empty}>No likes yet</Text>
                            }
                            renderItem={({ item }) => {
                                const isSelf =
                                    !!viewerHandle &&
                                    item.handle.toLowerCase() === viewerHandle.toLowerCase();
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
                                        >
                                            <Avatar
                                                src={item.avatar_url}
                                                name={
                                                    item.display_name ||
                                                    item.handle.split('@')[0]
                                                }
                                                size={36}
                                            />
                                            <View style={styles.nameCol}>
                                                <Text style={styles.handle} numberOfLines={1}>
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
                                                style={[
                                                    styles.followBtn,
                                                    isFollowing && styles.followBtnActive,
                                                ]}
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
                            }}
                        />
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
    },
    sheet: {
        maxHeight: '75%',
        backgroundColor: '#0b1220',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingBottom: 24,
    },
    handleBar: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#4B5563',
        marginTop: 10,
        marginBottom: 6,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 20,
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statLabel: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    statValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#F3F4F6',
    },
    loader: {
        paddingVertical: 32,
    },
    list: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        gap: 8,
    },
    rowLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
    },
    nameCol: {
        flex: 1,
        minWidth: 0,
    },
    handle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#F3F4F6',
    },
    subHandle: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
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
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.2)',
    },
    followBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    followBtnTextActive: {
        color: '#D1D5DB',
    },
    empty: {
        textAlign: 'center',
        color: '#6B7280',
        paddingVertical: 24,
    },
});

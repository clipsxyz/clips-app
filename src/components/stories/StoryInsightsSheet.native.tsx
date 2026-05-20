import React, { useEffect, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Pressable,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from '../Avatar';
import { getFollowedUsers } from '../../api/posts';
import { toggleFollow } from '../../api/client';
import { getAvatarForHandle } from '../../api/users';
import type { Story } from '../../types';
import { timeAgo } from '../../utils/timeAgo';

type Props = {
    visible: boolean;
    onClose: () => void;
    story: Story;
    currentUserId: string;
    currentUserHandle: string;
    avatarMap: Record<string, string | undefined>;
    navigation: { navigate: (screen: string, params?: object) => void };
    onBeforeNavigate: () => void;
};

export default function StoryInsightsSheet({
    visible,
    onClose,
    story,
    currentUserId,
    currentUserHandle,
    avatarMap,
    navigation,
    onBeforeNavigate,
}: Props) {
    const [tab, setTab] = useState<'viewers' | 'replies'>('viewers');
    const [viewerFollowMap, setViewerFollowMap] = useState<Record<string, boolean>>({});
    const [followLoadingHandle, setFollowLoadingHandle] = useState<string | null>(null);

    const viewsCount = Number(story.views || 0);
    const replies = story.replies || [];
    const viewerHandles = Array.from(new Set((story.viewerHandles || []).filter(Boolean)));

    useEffect(() => {
        if (!visible || tab !== 'viewers' || !currentUserId) return;
        let cancelled = false;
        void getFollowedUsers(currentUserId).then((followed) => {
            if (cancelled) return;
            const followedSet = new Set((followed || []).map((h) => (h || '').toLowerCase()));
            const next: Record<string, boolean> = {};
            viewerHandles.forEach((handle) => {
                const norm = (handle || '').toLowerCase();
                next[handle] =
                    norm === currentUserHandle.toLowerCase() || followedSet.has(norm);
            });
            setViewerFollowMap(next);
        });
        return () => {
            cancelled = true;
        };
    }, [visible, tab, currentUserId, currentUserHandle, viewerHandles.join('|')]);

    const toggleViewerFollow = async (handle: string) => {
        if (!currentUserId || followLoadingHandle) return;
        const prev = !!viewerFollowMap[handle];
        setFollowLoadingHandle(handle);
        setViewerFollowMap((m) => ({ ...m, [handle]: !prev }));
        try {
            const result = await toggleFollow(handle);
            const next =
                result?.status === 'unfollowed'
                    ? false
                    : result?.status === 'accepted' || result?.following === true
                      ? true
                      : !prev;
            setViewerFollowMap((m) => ({ ...m, [handle]: next }));
        } catch {
            setViewerFollowMap((m) => ({ ...m, [handle]: prev }));
        } finally {
            setFollowLoadingHandle(null);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.handle} />
                    <View style={styles.header}>
                        <Text style={styles.title}>Story insights</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Icon name="close" size={22} color="#D1D5DB" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.tabRow}>
                        <TouchableOpacity
                            style={[styles.tab, tab === 'viewers' && styles.tabActive]}
                            onPress={() => setTab('viewers')}
                        >
                            <Text style={[styles.tabText, tab === 'viewers' && styles.tabTextActive]}>
                                Viewers ({viewsCount})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, tab === 'replies' && styles.tabActive]}
                            onPress={() => setTab('replies')}
                        >
                            <Text style={[styles.tabText, tab === 'replies' && styles.tabTextActive]}>
                                Replies ({replies.length})
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                        {tab === 'viewers' ? (
                            <>
                                <View style={styles.summaryCard}>
                                    <Text style={styles.summaryTitle}>{viewsCount} total views</Text>
                                    <Text style={styles.summarySub}>
                                        Unique viewers: {viewerHandles.length}
                                    </Text>
                                </View>
                                {viewerHandles.length === 0 ? (
                                    <Text style={styles.empty}>No viewer identities yet.</Text>
                                ) : (
                                    viewerHandles.map((handle) => (
                                        <View key={handle} style={styles.viewerRow}>
                                            <TouchableOpacity
                                                style={styles.viewerMain}
                                                onPress={() => {
                                                    onBeforeNavigate();
                                                    onClose();
                                                    setTimeout(() => {
                                                        navigation.navigate('ViewProfile', { handle });
                                                    }, 100);
                                                }}
                                            >
                                                <Avatar
                                                    src={avatarMap[handle] || getAvatarForHandle(handle)}
                                                    name={handle}
                                                    size="sm"
                                                />
                                                <Text style={styles.viewerHandle} numberOfLines={1}>
                                                    {handle}
                                                </Text>
                                            </TouchableOpacity>
                                            {handle.toLowerCase() !== currentUserHandle.toLowerCase() ? (
                                                <TouchableOpacity
                                                    style={[
                                                        styles.followBtn,
                                                        viewerFollowMap[handle] && styles.followBtnActive,
                                                    ]}
                                                    disabled={followLoadingHandle === handle}
                                                    onPress={() => void toggleViewerFollow(handle)}
                                                >
                                                    {followLoadingHandle === handle ? (
                                                        <ActivityIndicator size="small" color="#fff" />
                                                    ) : (
                                                        <Text style={styles.followBtnText}>
                                                            {viewerFollowMap[handle] ? 'Following' : 'Follow'}
                                                        </Text>
                                                    )}
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>
                                    ))
                                )}
                            </>
                        ) : replies.length === 0 ? (
                            <Text style={styles.empty}>No replies yet.</Text>
                        ) : (
                            replies.map((reply) => (
                                <View key={reply.id} style={styles.replyCard}>
                                    <View style={styles.replyHeader}>
                                        <Text style={styles.replyUser}>{reply.userHandle}</Text>
                                        <Text style={styles.replyTime}>{timeAgo(reply.createdAt)}</Text>
                                    </View>
                                    <Text style={styles.replyText}>{reply.text}</Text>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#111827',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 16,
        paddingBottom: 24,
        paddingTop: 8,
        maxHeight: '75%',
    },
    handle: {
        width: 48,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.25)',
        alignSelf: 'center',
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    title: { color: '#fff', fontSize: 16, fontWeight: '700' },
    closeBtn: { padding: 8 },
    tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#1F2937',
        alignItems: 'center',
    },
    tabActive: { backgroundColor: '#fff' },
    tabText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700' },
    tabTextActive: { color: '#000' },
    scroll: { maxHeight: 420 },
    scrollContent: { paddingBottom: 16, gap: 8 },
    summaryCard: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 14,
    },
    summaryTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
    summarySub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
    empty: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    viewerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    viewerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
    viewerHandle: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
    followBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#3B82F6',
        minWidth: 72,
        alignItems: 'center',
    },
    followBtnActive: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    followBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    replyCard: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    replyHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    replyUser: { color: '#fff', fontSize: 14, fontWeight: '700' },
    replyTime: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
    replyText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 6 },
});

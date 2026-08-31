import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Image,
} from 'react-native';
import { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from '../Avatar';
import { getFollowedUsers } from '../../api/posts';
import { toggleFollow } from '../../api/client';
import { getAvatarForHandle } from '../../api/users';
import type { Story } from '../../types';
import { timeAgo } from '../../utils/timeAgo';
import GazetteerBottomSheetModal, { GAZETTEER_SHEET_CHARCOAL } from '../GazetteerBottomSheetModal.native';

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

/**
 * Instagram-style owner sheet: viewers list + who reacted (emoji) + replies.
 * Replies/reactions also live in Messages; this sheet is the per-story breakdown.
 */
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
    const [tab, setTab] = useState<'viewers' | 'reactions' | 'replies'>('viewers');
    const [viewerFollowMap, setViewerFollowMap] = useState<Record<string, boolean>>({});
    const [followLoadingHandle, setFollowLoadingHandle] = useState<string | null>(null);

    const ownerNorm = currentUserHandle.trim().toLowerCase();
    const viewsCount = Number(story.views_count ?? story.views ?? 0) || 0;
    const replies = (story.replies || []).filter(
        (r) => (r.userHandle || '').trim().toLowerCase() !== ownerNorm,
    );
    const reactions = (story.reactions || []).filter(
        (r) => (r.userHandle || '').trim().toLowerCase() !== ownerNorm,
    );
    const viewerHandles = Array.from(
        new Set(
            (story.viewerHandles || []).filter(
                (h) => !!h && h.trim().toLowerCase() !== ownerNorm,
            ),
        ),
    );
    const storyThumb = (story.mediaUrl || '').trim();
    const storyText = (story.text || '').trim();

    useEffect(() => {
        if (!visible) setTab('viewers');
    }, [visible, story.id]);

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

    const openProfile = (handle: string) => {
        onBeforeNavigate();
        onClose();
        setTimeout(() => {
            navigation.navigate('ViewProfile', { handle });
        }, 100);
    };

    const openMessages = (handle: string) => {
        onBeforeNavigate();
        onClose();
        setTimeout(() => {
            navigation.navigate('Messages', { handle });
        }, 100);
    };

    return (
        <GazetteerBottomSheetModal
            visible={visible}
            onDismiss={onClose}
            snapPoints={['78%']}
            horizontalInset={0}
            backgroundStyle={GAZETTEER_SHEET_CHARCOAL.background}
            handleIndicatorStyle={GAZETTEER_SHEET_CHARCOAL.handle}
        >
            <BottomSheetView style={styles.headerBlock}>
                <View style={styles.header}>
                    <Text style={styles.title}>Story insights</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Icon name="close" size={22} color="#D1D5DB" />
                    </TouchableOpacity>
                </View>

                <View style={styles.storyPreviewRow}>
                    {storyThumb && story.mediaType !== 'video' ? (
                        <Image source={{ uri: storyThumb }} style={styles.storyPreviewThumb} />
                    ) : storyText ? (
                        <View style={styles.storyPreviewTextBox}>
                            <Text style={styles.storyPreviewText} numberOfLines={4}>
                                {storyText}
                            </Text>
                        </View>
                    ) : (
                        <View style={[styles.storyPreviewThumb, styles.storyPreviewFallback]}>
                            <Icon name="images-outline" size={20} color="#9CA3AF" />
                        </View>
                    )}
                    <View style={styles.storyPreviewMeta}>
                        <Text style={styles.storyPreviewTitle} numberOfLines={2}>
                            {storyText || (story.mediaType === 'video' ? 'Video story' : 'Photo story')}
                        </Text>
                        <Text style={styles.storyPreviewSub}>
                            {viewsCount} views · {reactions.length} reactions · {replies.length} replies
                        </Text>
                    </View>
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
                        style={[styles.tab, tab === 'reactions' && styles.tabActive]}
                        onPress={() => setTab('reactions')}
                    >
                        <Text style={[styles.tabText, tab === 'reactions' && styles.tabTextActive]}>
                            Reactions ({reactions.length})
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
            </BottomSheetView>

            <BottomSheetScrollView
                contentContainerStyle={styles.scrollContent}
                style={styles.scroll}
            >
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
                                        onPress={() => openProfile(handle)}
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
                                </View>
                            ))
                        )}
                    </>
                ) : tab === 'reactions' ? (
                    reactions.length === 0 ? (
                        <Text style={styles.empty}>
                            No reactions from others yet. When someone reacts, it also appears in Messages with this story attached.
                        </Text>
                    ) : (
                        reactions.map((reaction) => (
                            <TouchableOpacity
                                key={`${reaction.id || reaction.userHandle}-${reaction.emoji}`}
                                style={styles.reactionRow}
                                onPress={() => openMessages(reaction.userHandle)}
                            >
                                <Avatar
                                    src={
                                        avatarMap[reaction.userHandle] ||
                                        getAvatarForHandle(reaction.userHandle)
                                    }
                                    name={reaction.userHandle}
                                    size="sm"
                                />
                                <View style={styles.reactionMain}>
                                    <Text style={styles.viewerHandle} numberOfLines={1}>
                                        {reaction.userHandle}
                                    </Text>
                                    <Text style={styles.reactionHint}>Open in Messages</Text>
                                </View>
                                <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                            </TouchableOpacity>
                        ))
                    )
                ) : replies.length === 0 ? (
                    <Text style={styles.empty}>
                        No replies from others yet. Story replies land in Messages with a preview of this story.
                    </Text>
                ) : (
                    replies.map((reply) => (
                        <TouchableOpacity
                            key={reply.id}
                            style={styles.replyCard}
                            onPress={() => openMessages(reply.userHandle)}
                        >
                            <View style={styles.replyHeader}>
                                <Text style={styles.replyUser}>{reply.userHandle}</Text>
                                <Text style={styles.replyTime}>{timeAgo(reply.createdAt)}</Text>
                            </View>
                            <Text style={styles.replyText}>{reply.text}</Text>
                            <Text style={styles.reactionHint}>Open in Messages</Text>
                        </TouchableOpacity>
                    ))
                )}
            </BottomSheetScrollView>
        </GazetteerBottomSheetModal>
    );
}

const styles = StyleSheet.create({
    headerBlock: {
        paddingHorizontal: 16,
        paddingTop: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    title: { color: '#fff', fontSize: 16, fontWeight: '700' },
    closeBtn: { padding: 8 },
    storyPreviewRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 14,
        alignItems: 'center',
    },
    storyPreviewThumb: {
        width: 56,
        height: 72,
        borderRadius: 10,
        backgroundColor: '#1F2937',
    },
    storyPreviewFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    storyPreviewTextBox: {
        width: 56,
        height: 72,
        borderRadius: 10,
        backgroundColor: '#1e3a5f',
        padding: 6,
        justifyContent: 'center',
    },
    storyPreviewText: {
        color: '#E5E7EB',
        fontSize: 9,
        lineHeight: 11,
        fontWeight: '600',
    },
    storyPreviewMeta: { flex: 1, minWidth: 0 },
    storyPreviewTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    storyPreviewSub: { color: '#9CA3AF', fontSize: 12 },
    tabRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    tab: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: 12,
        backgroundColor: '#1F2937',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    tabActive: { backgroundColor: '#374151' },
    tabText: { color: '#9CA3AF', fontSize: 11, fontWeight: '600', textAlign: 'center' },
    tabTextActive: { color: '#fff' },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
    summaryCard: {
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    summaryTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
    summarySub: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
    empty: { color: '#9CA3AF', fontSize: 13, lineHeight: 18, paddingVertical: 16 },
    viewerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 10,
    },
    viewerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
    viewerHandle: { color: '#fff', fontSize: 14, fontWeight: '600', flexShrink: 1 },
    followBtn: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: '#2563EB',
        minWidth: 84,
        alignItems: 'center',
    },
    followBtnActive: { backgroundColor: '#374151' },
    followBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    reactionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    reactionMain: { flex: 1, minWidth: 0 },
    reactionHint: { color: '#60A5FA', fontSize: 11, marginTop: 2 },
    reactionEmoji: { fontSize: 28 },
    replyCard: {
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
    },
    replyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    replyUser: { color: '#fff', fontWeight: '700', fontSize: 13 },
    replyTime: { color: '#9CA3AF', fontSize: 11 },
    replyText: { color: '#E5E7EB', fontSize: 14, lineHeight: 20 },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { apiRequest, updateUserCommentSettings } from '../api/client';
import {
    approveHiddenComment,
    deleteHiddenComment,
    fetchHiddenCommentsForOwner,
    type HiddenCommentReviewItem,
} from '../api/posts';
import GazetteerBottomSheetModal from './GazetteerBottomSheetModal.native';
import {
    applyRemoteCommentControls,
    getCommentModerationPreferences,
    setCommentModerationPreferences,
    type CommentAudience,
    type CommentModerationPreferences,
} from '../utils/commentModeration';

type AlertConfig = {
    title: string;
    message?: string;
    icon?: 'success' | 'alert' | 'info';
    confirmButtonText?: string;
    cancelButtonText?: string;
    showCancelButton?: boolean;
    onConfirm?: () => void;
};

type Props = {
    visible: boolean;
    onClose: () => void;
    ownerHandle?: string;
    onOpenPost: (postId: string) => void;
    showAlert: (config: AlertConfig) => void;
};

function ModerationToggle({
    label,
    description,
    enabled,
    onChange,
}: {
    label: string;
    description: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
}) {
    return (
        <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>{label}</Text>
                <Text style={styles.toggleDescription}>{description}</Text>
            </View>
            <Pressable
                style={[styles.toggleTrack, enabled && styles.toggleTrackActive]}
                onPress={() => onChange(!enabled)}
                accessibilityRole="switch"
                accessibilityState={{ checked: enabled }}
            >
                <View style={[styles.toggleThumb, enabled && styles.toggleThumbActive]} />
            </Pressable>
        </View>
    );
}

export default function CommentSafetyModal({ visible, onClose, ownerHandle, onOpenPost, showAlert }: Props) {
    const [commentModerationPrefs, setCommentModerationPrefs] = useState<CommentModerationPreferences>(
        getCommentModerationPreferences()
    );
    const [commentWordDraft, setCommentWordDraft] = useState('');
    const [hiddenCommentQueue, setHiddenCommentQueue] = useState<HiddenCommentReviewItem[]>([]);
    const [loadingHiddenCommentQueue, setLoadingHiddenCommentQueue] = useState(false);
    const [hiddenQueueFilter, setHiddenQueueFilter] = useState<'all' | 'comments' | 'replies'>('all');

    const filteredHiddenQueue = useMemo(() => {
        if (hiddenQueueFilter === 'comments') return hiddenCommentQueue.filter((item) => !item.isReply);
        if (hiddenQueueFilter === 'replies') return hiddenCommentQueue.filter((item) => !!item.isReply);
        return hiddenCommentQueue;
    }, [hiddenCommentQueue, hiddenQueueFilter]);

    const persistPrefs = useCallback((next: CommentModerationPreferences) => {
        setCommentModerationPrefs(next);
        setCommentModerationPreferences(next);
    }, []);

    useEffect(() => {
        if (!visible) return;
        setCommentModerationPrefs(getCommentModerationPreferences());
        let cancelled = false;
        void (async () => {
            try {
                const me = await apiRequest('/auth/me');
                if (cancelled || !me || typeof me !== 'object') return;
                applyRemoteCommentControls(me);
                if (!cancelled) setCommentModerationPrefs(getCommentModerationPreferences());
            } catch {
                // Keep the settings already stored on this phone.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [visible]);

    useEffect(() => {
        if (!visible || !ownerHandle) return;
        let cancelled = false;
        (async () => {
            setLoadingHiddenCommentQueue(true);
            try {
                const items = await fetchHiddenCommentsForOwner(ownerHandle);
                if (!cancelled) setHiddenCommentQueue(items);
            } catch (error) {
                console.error('Error loading hidden comments queue:', error);
                if (!cancelled) setHiddenCommentQueue([]);
            } finally {
                if (!cancelled) setLoadingHiddenCommentQueue(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [visible, ownerHandle]);

    const saveCommentControls = useCallback(
        async (allowComments: boolean, commentAudience: CommentAudience) => {
            const audience: CommentAudience = allowComments && commentAudience !== 'nobody' ? commentAudience : 'nobody';
            const next: CommentModerationPreferences = {
                ...commentModerationPrefs,
                allowComments: audience !== 'nobody',
                commentAudience: audience,
            };
            persistPrefs(next);
            try {
                await updateUserCommentSettings({
                    allow_comments: next.allowComments,
                    comment_audience: next.commentAudience,
                });
            } catch (error) {
                console.warn('Comment settings were not saved on the server', error);
                showAlert({
                    title: 'Saved on this phone',
                    message: 'Comment controls are on for your posts here. The server did not update.',
                    icon: 'alert',
                });
            }
        },
        [commentModerationPrefs, persistPrefs, showAlert],
    );

    const addHiddenWord = useCallback(() => {
        const incoming = String(commentWordDraft || '').trim().toLowerCase();
        if (!incoming) return;
        const next = {
            ...commentModerationPrefs,
            customHiddenWords: Array.from(new Set([...(commentModerationPrefs.customHiddenWords || []), incoming])),
        };
        persistPrefs(next);
        setCommentWordDraft('');
    }, [commentModerationPrefs, commentWordDraft, persistPrefs]);

    const handleReset = useCallback(() => {
        const resetPrefs = {
            ...commentModerationPrefs,
            strictMode: false,
            customHiddenWords: [] as string[],
        };
        persistPrefs(resetPrefs);
        setCommentWordDraft('');
        showAlert({
            title: 'Comment Safety Reset',
            message: 'Strict mode and hidden words were reset.',
            icon: 'success',
        });
    }, [commentModerationPrefs, persistPrefs, showAlert]);

    const handleApproveAll = useCallback(() => {
        if (filteredHiddenQueue.length === 0) return;
        showAlert({
            title: 'Approve all visible?',
            message: `This will approve ${filteredHiddenQueue.length} item(s) in the current filter.`,
            icon: 'alert',
            showCancelButton: true,
            confirmButtonText: 'Approve all',
            cancelButtonText: 'Cancel',
            onConfirm: async () => {
                await Promise.all(filteredHiddenQueue.map((item) => approveHiddenComment(item.id)));
                const approvedIds = new Set(filteredHiddenQueue.map((item) => item.id));
                setHiddenCommentQueue((prev) => prev.filter((row) => !approvedIds.has(row.id)));
                showAlert({
                    title: 'Approved',
                    message: 'Approved all visible items.',
                    icon: 'success',
                });
            },
        });
    }, [filteredHiddenQueue, showAlert]);

    const handleApprove = useCallback(async (itemId: string) => {
        const ok = await approveHiddenComment(itemId);
        if (!ok) return;
        setHiddenCommentQueue((prev) => prev.filter((row) => row.id !== itemId));
    }, []);

    const handleDelete = useCallback(
        (itemId: string) => {
            showAlert({
                title: 'Delete hidden comment?',
                message: 'This action cannot be undone.',
                icon: 'alert',
                showCancelButton: true,
                confirmButtonText: 'Delete',
                cancelButtonText: 'Cancel',
                onConfirm: async () => {
                    const ok = await deleteHiddenComment(itemId);
                    if (!ok) return;
                    setHiddenCommentQueue((prev) => prev.filter((row) => row.id !== itemId));
                },
            });
        },
        [showAlert]
    );

    const audiences: Array<{ id: CommentAudience; label: string }> = [
        { id: 'everyone', label: 'Everyone' },
        { id: 'followers', label: 'Followers only' },
        { id: 'nobody', label: 'Nobody (Turn off comments)' },
    ];

    return (
        <GazetteerBottomSheetModal
            visible={visible}
            onDismiss={onClose}
            snapPoints={['88%']}
            horizontalInset={0}
            backgroundStyle={styles.sheetBackground}
            handleIndicatorStyle={styles.handle}
        >
            <BottomSheetScrollView contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
                <LinearGradient
                    colors={['rgba(244,114,182,0)', 'rgba(244,114,182,0.7)', 'rgba(244,114,182,0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.accentLine}
                />
                <View style={styles.header}>
                    <Text style={styles.title}>Comment Safety</Text>
                    <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Close comment safety">
                        <Icon name="close" size={22} color="#FFFFFF" />
                    </Pressable>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Comment Controls</Text>
                    <ModerationToggle
                        label="Allow comments on posts"
                        description="Turn this off to stop new comments on your posts"
                        enabled={commentModerationPrefs.allowComments}
                        onChange={(enabled) => {
                            void saveCommentControls(
                                enabled,
                                enabled
                                    ? commentModerationPrefs.commentAudience === 'nobody'
                                        ? 'everyone'
                                        : commentModerationPrefs.commentAudience
                                    : 'nobody',
                            );
                        }}
                    />
                    <View style={styles.audienceList}>
                        {audiences.map((option) => {
                            const selected = commentModerationPrefs.commentAudience === option.id;
                            return (
                                <Pressable
                                    key={option.id}
                                    style={[styles.audienceRow, selected && styles.audienceRowSelected]}
                                    onPress={() => {
                                        void saveCommentControls(option.id !== 'nobody', option.id);
                                    }}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected }}
                                >
                                    <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                                        {selected ? <View style={styles.radioInner} /> : null}
                                    </View>
                                    <Text style={[styles.audienceLabel, selected && styles.audienceLabelSelected]}>
                                        {option.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                <View style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Comment Filters</Text>
                                <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                                    <Text style={styles.resetButtonText}>Reset</Text>
                                </TouchableOpacity>
                            </View>

                            <ModerationToggle
                                label="Strict filtering"
                                description="Auto-hide warning-level negative comments"
                                enabled={commentModerationPrefs.strictMode}
                                onChange={(enabled) => {
                                    persistPrefs({ ...commentModerationPrefs, strictMode: enabled });
                                }}
                            />

                            <Text style={styles.inputLabel}>Hidden words and phrases</Text>
                            <View style={styles.wordInputRow}>
                                <BottomSheetTextInput
                                    style={styles.wordInput}
                                    value={commentWordDraft}
                                    onChangeText={setCommentWordDraft}
                                    placeholder="Add word or phrase to auto-hide"
                                    placeholderTextColor="#9CA3AF"
                                    returnKeyType="done"
                                    onSubmitEditing={addHiddenWord}
                                />
                                <TouchableOpacity style={styles.addWordButton} onPress={addHiddenWord}>
                                    <Text style={styles.addWordButtonText}>Add</Text>
                                </TouchableOpacity>
                            </View>

                            {(commentModerationPrefs.customHiddenWords || []).length > 0 ? (
                                <View style={styles.wordChipWrap}>
                                    {(commentModerationPrefs.customHiddenWords || []).map((word) => (
                                        <TouchableOpacity
                                            key={word}
                                            style={styles.wordChip}
                                            onPress={() => {
                                                persistPrefs({
                                                    ...commentModerationPrefs,
                                                    customHiddenWords: (commentModerationPrefs.customHiddenWords || []).filter(
                                                        (w) => w !== word
                                                    ),
                                                });
                                            }}
                                        >
                                            <Text style={styles.wordChipText}>{word} ×</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : (
                                <Text style={styles.emptyWordsText}>No hidden words added yet.</Text>
                            )}
                        </View>

                        <View style={styles.reviewBox}>
                            <View style={styles.reviewHeader}>
                                <Text style={styles.reviewTitle}>Hidden comments review</Text>
                                <View style={styles.reviewHeaderActions}>
                                    <Text style={styles.queueCountText}>{hiddenCommentQueue.length} pending</Text>
                                    {filteredHiddenQueue.length > 0 ? (
                                        <TouchableOpacity style={styles.approveAllButton} onPress={handleApproveAll}>
                                            <Text style={styles.approveAllButtonText}>Approve all</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            </View>

                            <View style={styles.filterPillsRow}>
                                {(['all', 'comments', 'replies'] as const).map((filterKey) => (
                                    <TouchableOpacity
                                        key={filterKey}
                                        style={[styles.filterPill, hiddenQueueFilter === filterKey && styles.filterPillActive]}
                                        onPress={() => setHiddenQueueFilter(filterKey)}
                                    >
                                        <Text
                                            style={[
                                                styles.filterPillText,
                                                hiddenQueueFilter === filterKey && styles.filterPillTextActive,
                                            ]}
                                        >
                                            {filterKey === 'all' ? 'All' : filterKey === 'comments' ? 'Comments' : 'Replies'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {loadingHiddenCommentQueue ? (
                                <Text style={styles.queueEmptyText}>Loading review queue...</Text>
                            ) : filteredHiddenQueue.length === 0 ? (
                                <Text style={styles.queueEmptyText}>No hidden comments to review right now.</Text>
                            ) : (
                                <View style={styles.queueList}>
                                    {filteredHiddenQueue.map((item) => (
                                        <View key={item.id} style={styles.queueItem}>
                                            <View style={styles.queueItemBody}>
                                                <Text style={styles.queueItemAuthor}>
                                                    {item.userHandle} {item.isReply ? 'replied' : 'commented'}
                                                </Text>
                                                <Text style={styles.queueItemText} numberOfLines={2}>
                                                    {item.text}
                                                </Text>
                                                {item.moderationReason ? (
                                                    <Text style={styles.queueItemReason}>Reason: {item.moderationReason}</Text>
                                                ) : null}
                                            </View>
                                            <View style={styles.queueActions}>
                                                <TouchableOpacity
                                                    style={styles.queueActionBtn}
                                                    onPress={() => onOpenPost(item.postId)}
                                                >
                                                    <Text style={styles.queueActionText}>Open post</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.queueActionBtn}
                                                    onPress={() => void handleApprove(item.id)}
                                                >
                                                    <Text style={styles.queueActionText}>Approve</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.queueActionBtn, styles.queueActionBtnDanger]}
                                                    onPress={() => handleDelete(item.id)}
                                                >
                                                    <Text style={[styles.queueActionText, styles.queueActionTextDanger]}>Delete</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
            </BottomSheetScrollView>
        </GazetteerBottomSheetModal>
    );
}

const styles = StyleSheet.create({
    sheetBackground: {
        backgroundColor: '#0B0E14',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(244,114,182,0.28)',
    },
    handle: {
        backgroundColor: 'rgba(255,255,255,0.32)',
        width: 42,
    },
    accentLine: {
        height: 2,
        marginHorizontal: 20,
        marginBottom: 8,
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
        paddingBottom: 8,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    closeButton: {
        padding: 8,
        borderRadius: 999,
    },
    body: {
        maxHeight: '100%',
    },
    bodyContent: {
        paddingHorizontal: 16,
        paddingBottom: 36,
        gap: 14,
    },
    card: {
        backgroundColor: '#161B22',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 14,
        gap: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#8B949E',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    resetButton: {
        backgroundColor: '#21262D',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    resetButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    toggleInfo: {
        flex: 1,
        paddingRight: 12,
    },
    toggleLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    toggleDescription: {
        marginTop: 2,
        fontSize: 12,
        color: '#8B949E',
    },
    toggleTrack: {
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#30363D',
        justifyContent: 'center',
        paddingHorizontal: 2,
    },
    toggleTrackActive: {
        backgroundColor: '#d91b5c',
    },
    toggleThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
    },
    toggleThumbActive: {
        alignSelf: 'flex-end',
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8B949E',
    },
    wordInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    wordInput: {
        flex: 1,
        minWidth: 0,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#2A2F3D',
        backgroundColor: '#0B0E14',
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#FFFFFF',
        fontSize: 14,
    },
    addWordButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    addWordButtonText: {
        color: '#0B0E14',
        fontSize: 14,
        fontWeight: '700',
    },
    wordChipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    wordChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#2A2F3D',
        backgroundColor: '#0B0E14',
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    wordChipText: {
        fontSize: 12,
        color: '#FFFFFF',
    },
    emptyWordsText: {
        fontSize: 12,
        color: '#8B949E',
    },
    reviewBox: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: '#161B22',
        padding: 12,
        gap: 8,
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    reviewTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    reviewHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    queueCountText: {
        fontSize: 12,
        color: '#8B949E',
    },
    approveAllButton: {
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#2A2F3D',
        backgroundColor: '#21262D',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    approveAllButtonText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    filterPillsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    filterPill: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#2A2F3D',
        backgroundColor: '#0B0E14',
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    filterPillActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FFFFFF',
    },
    filterPillText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#8B949E',
    },
    filterPillTextActive: {
        color: '#0B0E14',
    },
    queueEmptyText: {
        fontSize: 12,
        color: '#8B949E',
    },
    queueList: {
        maxHeight: 192,
        gap: 8,
    },
    queueItem: {
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#2A2F3D',
        backgroundColor: '#0B0E14',
        padding: 10,
        gap: 8,
    },
    queueItemBody: {
        minWidth: 0,
    },
    queueItemAuthor: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    queueItemText: {
        fontSize: 12,
        color: '#C9D1D9',
    },
    queueItemReason: {
        marginTop: 2,
        fontSize: 11,
        color: '#F472B6',
    },
    queueActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    queueActionBtn: {
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#2A2F3D',
        backgroundColor: '#21262D',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    queueActionBtnDanger: {
        borderColor: 'rgba(229,57,53,0.45)',
        backgroundColor: 'rgba(229,57,53,0.16)',
    },
    queueActionText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    queueActionTextDanger: {
        color: '#FF8A80',
    },
    audienceList: {
        gap: 8,
    },
    audienceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#2A2F3D',
        backgroundColor: '#0B0E14',
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    audienceRowSelected: {
        borderColor: 'rgba(244,114,182,0.7)',
    },
    radioOuter: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: '#8B949E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterSelected: {
        borderColor: '#F472B6',
    },
    radioInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#F472B6',
    },
    audienceLabel: {
        flex: 1,
        color: '#C9D1D9',
        fontSize: 14,
        fontWeight: '600',
    },
    audienceLabelSelected: {
        color: '#FFFFFF',
    },
});

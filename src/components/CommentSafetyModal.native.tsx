import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
    approveHiddenComment,
    deleteHiddenComment,
    fetchHiddenCommentsForOwner,
    type HiddenCommentReviewItem,
} from '../api/posts';
import {
    getCommentModerationPreferences,
    setCommentModerationPreferences,
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

    useEffect(() => {
        if (!visible) return;
        setCommentModerationPrefs(getCommentModerationPreferences());
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

    const persistPrefs = useCallback((next: CommentModerationPreferences) => {
        setCommentModerationPrefs(next);
        setCommentModerationPreferences(next);
    }, []);

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
        const resetPrefs = { strictMode: false, customHiddenWords: [] };
        persistPrefs(resetPrefs);
        setCommentWordDraft('');
        showAlert({
            title: 'Comment Safety Reset',
            message: 'Strict mode and hidden words were reset.',
            icon: 'success',
        });
    }, [persistPrefs, showAlert]);

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

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close Comment Safety" />
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Comment Safety</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close">
                            <Icon name="close" size={24} color="#4B5563" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
                        <View style={styles.section}>
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
                                <TextInput
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
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        padding: 16,
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        maxHeight: '80%',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    closeButton: {
        padding: 8,
        borderRadius: 999,
    },
    body: {
        maxHeight: '100%',
    },
    bodyContent: {
        padding: 24,
        gap: 24,
    },
    section: {
        gap: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    resetButton: {
        backgroundColor: '#374151',
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
        color: '#111827',
    },
    toggleDescription: {
        marginTop: 2,
        fontSize: 12,
        color: '#6B7280',
    },
    toggleTrack: {
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#E5E7EB',
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
        color: '#111827',
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
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#111827',
        fontSize: 14,
    },
    addWordButton: {
        backgroundColor: '#111827',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    addWordButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    wordChipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    wordChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    wordChipText: {
        fontSize: 12,
        color: '#374151',
    },
    emptyWordsText: {
        fontSize: 12,
        color: '#6B7280',
    },
    reviewBox: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FDE68A',
        backgroundColor: 'rgba(255, 251, 235, 0.4)',
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
        color: '#111827',
    },
    reviewHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    queueCountText: {
        fontSize: 12,
        color: '#92400E',
    },
    approveAllButton: {
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    approveAllButtonText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#374151',
    },
    filterPillsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    filterPill: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    filterPillActive: {
        backgroundColor: '#111827',
        borderColor: '#111827',
    },
    filterPillText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#374151',
    },
    filterPillTextActive: {
        color: '#FFFFFF',
    },
    queueEmptyText: {
        fontSize: 12,
        color: '#4B5563',
    },
    queueList: {
        maxHeight: 192,
        gap: 8,
    },
    queueItem: {
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FEF3C7',
        backgroundColor: '#FFFFFF',
        padding: 10,
        gap: 8,
    },
    queueItemBody: {
        minWidth: 0,
    },
    queueItemAuthor: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },
    queueItemText: {
        fontSize: 12,
        color: '#374151',
    },
    queueItemReason: {
        marginTop: 2,
        fontSize: 11,
        color: '#92400E',
    },
    queueActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    queueActionBtn: {
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    queueActionBtnDanger: {
        borderColor: '#FECACA',
        backgroundColor: '#FEF2F2',
    },
    queueActionText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#374151',
    },
    queueActionTextDanger: {
        color: '#B91C1C',
    },
});

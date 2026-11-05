import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import type { Draft } from '../api/drafts';
import CarouselSlideThumb from './CarouselSlideThumb.native';
import GazetteerBottomSheetModal from './GazetteerBottomSheetModal.native';

const SHEET_BG = '#0B0E14';

type Props = {
    visible: boolean;
    drafts: Draft[];
    onClose: () => void;
    onResume: (draft: Draft) => void;
    onDelete: (draftId: string) => void;
};

function formatDraftDate(timestamp: number): string {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function draftPlace(draft: Draft): string {
    const parts = [draft.location, draft.venue, draft.landmark]
        .map((value) => (value || '').trim())
        .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
    return parts.join(' · ');
}

function draftPreview(draft: Draft): string {
    const text = (draft.caption || draft.textBody || '').trim();
    return text || 'No caption yet';
}

function draftVisual(draft: Draft): { uri: string; type: 'image' | 'video'; poster?: string } | null {
    if (draft.isTextOnly) return null;
    const poster = (draft.videoPosterUrl || '').trim();
    const videoUrl = (draft.videoUrl || '').trim();
    const first = draft.mediaItems?.find((item) => (item.url || '').trim());
    const itemUrl = (first?.url || '').trim();
    const type = draft.mediaType || first?.type;
    const mediaUri = videoUrl || itemUrl;
    if (!mediaUri && !poster) return null;
    if (type === 'video' || (!poster && mediaUri && type !== 'image')) {
        return { uri: mediaUri || poster, type: 'video', poster: poster || undefined };
    }
    return { uri: poster || mediaUri, type: 'image', poster: poster || undefined };
}

function DraftCard({
    visual,
    header,
    preview,
    onResume,
    onDelete,
}: {
    visual: { uri: string; type: 'image' | 'video'; poster?: string } | null;
    header: string;
    preview: string;
    onResume: () => void;
    onDelete: () => void;
}) {
    const skipResume = useRef(false);
    return (
        <Pressable
            style={styles.card}
            onPress={() => {
                if (skipResume.current) {
                    skipResume.current = false;
                    return;
                }
                onResume();
            }}
            accessibilityRole="button"
            accessibilityLabel="Resume draft"
        >
            {visual ? (
                <View style={styles.thumb}>
                    <CarouselSlideThumb
                        size={48}
                        uri={visual.uri}
                        type={visual.type}
                        posterUrl={visual.poster}
                        allowPausedVideo
                    />
                </View>
            ) : null}
            <View style={styles.middle}>
                {header ? (
                    <Text style={styles.meta} numberOfLines={1}>
                        {header}
                    </Text>
                ) : null}
                <Text
                    style={[styles.preview, preview === 'No caption yet' && styles.previewMuted]}
                    numberOfLines={2}
                >
                    {preview}
                </Text>
            </View>
            <View style={styles.actions}>
                <View style={styles.resumeButton}>
                    <Text style={styles.resumeText}>Resume</Text>
                </View>
                <Pressable
                    style={styles.deleteButton}
                    onPressIn={() => {
                        skipResume.current = true;
                    }}
                    onPress={onDelete}
                    onPressOut={() => {
                        setTimeout(() => {
                            skipResume.current = false;
                        }, 0);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Delete draft"
                >
                    <Icon name="trash" size={16} color="#FCA5A5" />
                </Pressable>
            </View>
        </Pressable>
    );
}

export default function DraftsSheet({ visible, drafts, onClose, onResume, onDelete }: Props) {
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const confirmDelete = (draftId: string) => {
        setPendingDeleteId(draftId);
    };
    const closeDeletePrompt = () => setPendingDeleteId(null);
    const confirmDeleteDraft = () => {
        if (!pendingDeleteId) return;
        const draftId = pendingDeleteId;
        setPendingDeleteId(null);
        onDelete(draftId);
    };

    return (
        <>
        <GazetteerBottomSheetModal
            visible={visible}
            onDismiss={onClose}
            snapPoints={['72%']}
            horizontalInset={0}
            backgroundStyle={styles.sheetBackground}
            handleIndicatorStyle={styles.handle}
        >
            <BottomSheetScrollView contentContainerStyle={styles.content}>
                <LinearGradient
                    colors={['rgba(244,114,182,0)', 'rgba(244,114,182,0.7)', 'rgba(244,114,182,0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.accentLine}
                />
                <View style={styles.header}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>Drafts</Text>
                        <View style={styles.countBadge}>
                            <Text style={styles.countText}>{drafts.length}</Text>
                        </View>
                    </View>
                    <Pressable
                        onPress={onClose}
                        hitSlop={8}
                        style={styles.closeButton}
                        accessibilityRole="button"
                        accessibilityLabel="Close drafts"
                    >
                        <Icon name="close" size={22} color="#FFFFFF" />
                    </Pressable>
                </View>

                {drafts.length === 0 ? (
                    <View style={styles.empty}>
                        <Icon name="document-text-outline" size={36} color="rgba(255,255,255,0.45)" />
                        <Text style={styles.emptyText}>No drafts saved yet</Text>
                    </View>
                ) : (
                    drafts.map((draft) => {
                        const place = draftPlace(draft);
                        const when = formatDraftDate(draft.updatedAt || draft.createdAt);
                        const header = [when, place].filter(Boolean).join(' · ');
                        const preview = draftPreview(draft);
                        return (
                            <DraftCard
                                key={draft.id}
                                visual={draftVisual(draft)}
                                header={header}
                                preview={preview}
                                onResume={() => onResume(draft)}
                                onDelete={() => confirmDelete(draft.id)}
                            />
                        );
                    })
                )}
            </BottomSheetScrollView>
        </GazetteerBottomSheetModal>
            <Modal
                visible={pendingDeleteId !== null}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={closeDeletePrompt}
            >
                <View style={styles.deleteBackdrop}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={closeDeletePrompt} />
                    <View style={styles.deleteCard}>
                        <View style={styles.deleteIconWrap}>
                            <Icon name="trash" size={22} color="#FF8A80" />
                        </View>
                        <Text style={styles.deleteTitle}>Delete draft?</Text>
                        <Text style={styles.deleteSubtitle}>
                            This draft will be permanently removed from your phone. This action cannot be undone.
                        </Text>
                        <Pressable
                            style={styles.deleteConfirm}
                            onPress={confirmDeleteDraft}
                            accessibilityRole="button"
                            accessibilityLabel="Delete draft"
                        >
                            <Text style={styles.deleteConfirmText}>Delete</Text>
                        </Pressable>
                        <Pressable
                            style={styles.deleteCancel}
                            onPress={closeDeletePrompt}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel delete"
                        >
                            <Text style={styles.deleteCancelText}>Cancel</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    sheetBackground: {
        backgroundColor: SHEET_BG,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(244, 114, 182, 0.35)',
    },
    handle: {
        width: 40,
        backgroundColor: 'rgba(255,255,255,0.32)',
    },
    content: {
        paddingHorizontal: 16,
        paddingBottom: 28,
    },
    accentLine: {
        height: 2,
        borderRadius: 1,
        marginBottom: 14,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '700',
    },
    countBadge: {
        minWidth: 24,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        alignItems: 'center',
        backgroundColor: 'rgba(244, 114, 182, 0.18)',
        borderWidth: 1,
        borderColor: 'rgba(244, 114, 182, 0.4)',
    },
    countText: {
        color: '#FBCFE8',
        fontSize: 13,
        fontWeight: '700',
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    empty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        gap: 10,
    },
    emptyText: {
        color: 'rgba(255,255,255,0.62)',
        fontSize: 15,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 12,
        paddingVertical: 18,
        paddingHorizontal: 14,
        marginBottom: 10,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    thumb: {
        width: 48,
        height: 48,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#151922',
        alignSelf: 'center',
    },
    middle: {
        flex: 1,
        minWidth: 0,
        justifyContent: 'center',
    },
    meta: {
        color: '#9CA3AF',
        fontSize: 12,
        marginBottom: 4,
    },
    preview: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
        lineHeight: 20,
    },
    previewMuted: {
        color: '#6B7280',
        fontWeight: '600',
    },
    actions: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingVertical: 2,
        minHeight: 76,
    },
    resumeButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
    },
    resumeText: {
        color: SHEET_BG,
        fontSize: 12,
        fontWeight: '700',
    },
    deleteButton: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.16)',
    },
    deleteBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    deleteCard: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 18,
        backgroundColor: '#161B22',
        borderWidth: 1,
        borderColor: '#2A2F3D',
        paddingHorizontal: 20,
        paddingTop: 22,
        paddingBottom: 16,
        alignItems: 'center',
    },
    deleteIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(229, 57, 53, 0.16)',
        marginBottom: 14,
    },
    deleteTitle: {
        color: '#FFFFFF',
        fontSize: 19,
        fontWeight: '700',
        textAlign: 'center',
    },
    deleteSubtitle: {
        marginTop: 8,
        color: '#8B949E',
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
    deleteConfirm: {
        marginTop: 18,
        width: '100%',
        borderRadius: 12,
        backgroundColor: '#E53935',
        paddingVertical: 13,
        alignItems: 'center',
    },
    deleteConfirmText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    deleteCancel: {
        marginTop: 8,
        width: '100%',
        borderRadius: 12,
        backgroundColor: '#21262D',
        paddingVertical: 13,
        alignItems: 'center',
    },
    deleteCancelText: {
        color: '#E6EDF3',
        fontSize: 15,
        fontWeight: '600',
    },
});

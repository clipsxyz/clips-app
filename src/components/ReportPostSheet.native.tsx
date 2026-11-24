import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { getReportReasonOptions, reportPost, type ReportPostReason } from '../api/reports';
import GazetteerBottomSheetModal, { GAZETTEER_SHEET_INBOX } from './GazetteerBottomSheetModal.native';
import {
    UCL_CANVAS_NAVY,
    UCL_TEXT_PLACEHOLDER,
    UCL_TEXT_PRIMARY,
} from '../theme/gazetteerAmbientNative';
import {
    closeReportPost,
    subscribeReportPost,
    type ReportPostRequest,
} from '../utils/reportPostSession';
import {
    currentFollowUp,
    goBackInReport,
    initialReportDraft,
    pickReportChoice,
    pickReportReason,
    reportAuthorLabel,
    reportDetailsText,
    reportSafetyNote,
    reportSummaryRows,
    type ReportDraft,
} from '../utils/reportPostFlow';

type ActionKey = 'hide' | 'mute' | 'block';

function ReportPostSheet({
    request,
    onClose,
}: {
    request: ReportPostRequest;
    onClose: () => void;
}) {
    const [draft, setDraft] = useState<ReportDraft>(initialReportDraft);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [doneActions, setDoneActions] = useState<ActionKey[]>([]);
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        setDraft(initialReportDraft);
        setNote('');
        setSubmitting(false);
        setError(null);
        setDoneActions([]);
        setActionError(null);
    }, [request.id]);

    const follow = currentFollowUp(draft);
    const safety = reportSafetyNote(draft);
    const author = reportAuthorLabel(request.authorHandle);
    const showBack = draft.phase === 'follow' || draft.phase === 'summary';

    const submit = async () => {
        if (!draft.reason || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await reportPost(request.postId, draft.reason, reportDetailsText(draft.answers, note), draft.answers);
            setDraft((prev) => ({ ...prev, phase: 'done' }));
        } catch {
            setError('Could not send the report. Try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const runAction = async (key: ActionKey) => {
        if (doneActions.includes(key)) return;
        setActionError(null);
        try {
            if (key === 'hide') await request.onHide?.();
            if (key === 'mute') await request.onMute?.();
            if (key === 'block') await request.onBlock?.();
            setDoneActions((prev) => [...prev, key]);
        } catch {
            setActionError('That did not work. Try again.');
        }
    };

    return (
        <GazetteerBottomSheetModal
            visible
            onDismiss={onClose}
            snapPoints={['78%']}
            horizontalInset={0}
            backgroundStyle={GAZETTEER_SHEET_INBOX.background}
            handleIndicatorStyle={GAZETTEER_SHEET_INBOX.handle}
            backdropOpacity={0.6}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustResize"
        >
            <BottomSheetScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    {showBack ? (
                        <Pressable
                            style={styles.iconBtn}
                            onPress={() => setDraft((prev) => goBackInReport(prev))}
                            accessibilityRole="button"
                            accessibilityLabel="Back"
                        >
                            <Icon name="chevron-back" size={22} color={UCL_TEXT_PRIMARY} />
                        </Pressable>
                    ) : (
                        <View style={styles.iconBtn} />
                    )}
                    <Text style={styles.title} numberOfLines={1}>
                        {draft.phase === 'done' ? 'Report sent' : 'Report post'}
                    </Text>
                    <Pressable
                        style={styles.iconBtn}
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel="Close"
                    >
                        <Icon name="close" size={22} color={UCL_TEXT_PRIMARY} />
                    </Pressable>
                </View>

                {draft.phase === 'reason' ? (
                    <>
                        <Text style={styles.question}>Why are you reporting this post?</Text>
                        {getReportReasonOptions().map((option) => (
                            <ChoiceRow
                                key={option.id}
                                label={option.label}
                                onPress={() => setDraft(pickReportReason(option.id as ReportPostReason))}
                            />
                        ))}
                    </>
                ) : null}

                {draft.phase === 'follow' && follow ? (
                    <>
                        <Text style={styles.question}>{follow.question}</Text>
                        {follow.choices.map((choice) => (
                            <ChoiceRow
                                key={choice.id}
                                label={choice.label}
                                onPress={() => setDraft((prev) => pickReportChoice(prev, choice))}
                            />
                        ))}
                    </>
                ) : null}

                {draft.phase === 'summary' ? (
                    <>
                        <Text style={styles.question}>Review your report</Text>
                        {reportSummaryRows(draft).map((line) => (
                            <Text key={line} style={styles.summaryLine}>
                                {line}
                            </Text>
                        ))}
                        {safety ? <Text style={styles.safety}>{safety}</Text> : null}
                        <Text style={styles.noteLabel}>Add a note</Text>
                        <BottomSheetTextInput
                            style={styles.note}
                            value={note}
                            onChangeText={setNote}
                            placeholder="Optional"
                            placeholderTextColor={UCL_TEXT_PLACEHOLDER}
                            maxLength={300}
                            multiline
                            editable={!submitting}
                        />
                        {error ? <Text style={styles.error}>{error}</Text> : null}
                        <Pressable
                            style={[styles.submit, submitting && styles.submitDisabled]}
                            onPress={() => void submit()}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#000000" />
                            ) : (
                                <Text style={styles.submitText}>Submit</Text>
                            )}
                        </Pressable>
                    </>
                ) : null}

                {draft.phase === 'done' ? (
                    <>
                        <Text style={styles.thanks}>
                            Thanks for reporting. We will review this post. {author} is not told who reported it.
                        </Text>
                        {safety ? <Text style={styles.safety}>{safety}</Text> : null}
                        <Text style={styles.question}>While you wait, you can hide it from your feed.</Text>
                        {request.onHide ? (
                            <ChoiceRow
                                label={doneActions.includes('hide') ? 'Post hidden' : 'Hide post'}
                                onPress={() => void runAction('hide')}
                            />
                        ) : null}
                        {request.onMute ? (
                            <ChoiceRow
                                label={doneActions.includes('mute') ? `Muted ${author}` : `Mute ${author}`}
                                onPress={() => void runAction('mute')}
                            />
                        ) : null}
                        {request.onBlock ? (
                            <ChoiceRow
                                label={doneActions.includes('block') ? `Blocked ${author}` : `Block ${author}`}
                                danger
                                onPress={() => void runAction('block')}
                            />
                        ) : null}
                        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
                        <Pressable style={styles.submit} onPress={onClose}>
                            <Text style={styles.submitText}>Done</Text>
                        </Pressable>
                    </>
                ) : null}
            </BottomSheetScrollView>
        </GazetteerBottomSheetModal>
    );
}

function ChoiceRow({
    label,
    onPress,
    danger,
}: {
    label: string;
    onPress: () => void;
    danger?: boolean;
}) {
    return (
        <Pressable style={styles.choice} onPress={onPress}>
            <Text style={[styles.choiceText, danger && styles.choiceDanger]}>{label}</Text>
            <Icon name="chevron-forward" size={18} color="rgba(255,255,255,0.45)" />
        </Pressable>
    );
}

export default function ReportPostSheetHost() {
    const [request, setRequest] = useState<ReportPostRequest | null>(null);

    useEffect(() => subscribeReportPost(setRequest), []);

    if (!request) return null;

    return (
        <ReportPostSheet
            request={request}
            onClose={() => {
                closeReportPost(request.id);
                setRequest(null);
            }}
        />
    );
}

const styles = StyleSheet.create({
    scroll: {
        paddingHorizontal: 16,
        paddingBottom: 28,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 4,
        paddingBottom: 12,
    },
    iconBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        flex: 1,
        textAlign: 'center',
        color: UCL_TEXT_PRIMARY,
        fontSize: 18,
        fontWeight: '600',
    },
    question: {
        color: UCL_TEXT_PRIMARY,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    choice: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.12)',
    },
    choiceText: {
        flex: 1,
        color: UCL_TEXT_PRIMARY,
        fontSize: 16,
        marginRight: 12,
    },
    choiceDanger: {
        color: '#FCA5A5',
    },
    summaryLine: {
        color: '#E2E8F0',
        fontSize: 15,
        marginBottom: 8,
    },
    safety: {
        color: '#FDE68A',
        fontSize: 13,
        lineHeight: 18,
        marginTop: 4,
        marginBottom: 12,
    },
    noteLabel: {
        color: '#E2E8F0',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginTop: 8,
        marginBottom: 6,
    },
    note: {
        minHeight: 72,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 10,
        color: UCL_TEXT_PRIMARY,
        fontSize: 15,
        paddingHorizontal: 12,
        paddingVertical: 12,
        textAlignVertical: 'top',
    },
    error: {
        color: '#FCA5A5',
        fontSize: 13,
        marginTop: 10,
    },
    submit: {
        marginTop: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitDisabled: {
        opacity: 0.6,
    },
    submitText: {
        color: UCL_CANVAS_NAVY,
        fontSize: 15,
        fontWeight: '700',
    },
    thanks: {
        color: '#E2E8F0',
        fontSize: 15,
        lineHeight: 21,
        marginBottom: 16,
    },
});

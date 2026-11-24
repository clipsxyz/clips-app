import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getReportReasonOptions, reportPost, type ReportPostReason } from '../api/reports';
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

    return createPortal(
        <div className="fixed inset-0 z-[320] flex items-end justify-center">
            <button
                type="button"
                className="absolute inset-0 bg-black/60"
                aria-label="Close report"
                onClick={onClose}
            />
            <div className="relative flex max-h-[85vh] w-full max-w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-t-[24px] bg-[#03091B] shadow-2xl">
                <div className="flex justify-center pt-2.5 pb-1">
                    <div className="h-0.5 w-10 rounded-full bg-white/30" />
                </div>
                <div className="flex items-center gap-2 px-3 pb-2">
                    {showBack ? (
                        <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center text-white"
                            onClick={() => setDraft((prev) => goBackInReport(prev))}
                            aria-label="Back"
                        >
                            ‹
                        </button>
                    ) : (
                        <span className="h-9 w-9" />
                    )}
                    <h2 className="flex-1 text-center text-lg font-semibold text-white">
                        {draft.phase === 'done' ? 'Report sent' : 'Report post'}
                    </h2>
                    <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center text-white"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>
                <div className="overflow-y-auto px-4 pb-6">
                    {draft.phase === 'reason' ? (
                        <>
                            <p className="mb-2 text-base font-semibold text-white">Why are you reporting this post?</p>
                            {getReportReasonOptions().map((option) => (
                                <ChoiceButton
                                    key={option.id}
                                    label={option.label}
                                    onClick={() => setDraft(pickReportReason(option.id as ReportPostReason))}
                                />
                            ))}
                        </>
                    ) : null}

                    {draft.phase === 'follow' && follow ? (
                        <>
                            <p className="mb-2 text-base font-semibold text-white">{follow.question}</p>
                            {follow.choices.map((choice) => (
                                <ChoiceButton
                                    key={choice.id}
                                    label={choice.label}
                                    onClick={() => setDraft((prev) => pickReportChoice(prev, choice))}
                                />
                            ))}
                        </>
                    ) : null}

                    {draft.phase === 'summary' ? (
                        <>
                            <p className="mb-2 text-base font-semibold text-white">Review your report</p>
                            {reportSummaryRows(draft).map((line) => (
                                <p key={line} className="mb-1.5 text-[15px] text-slate-200">
                                    {line}
                                </p>
                            ))}
                            {safety ? <p className="mb-3 mt-2 text-sm text-amber-200">{safety}</p> : null}
                            <label className="mt-2 mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-200">
                                Add a note
                                <textarea
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    maxLength={300}
                                    placeholder="Optional"
                                    disabled={submitting}
                                    className="mt-1.5 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-[15px] font-normal normal-case tracking-normal text-white placeholder:text-slate-500 focus:outline-none"
                                    rows={3}
                                />
                            </label>
                            {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
                            <button
                                type="button"
                                className="mt-4 w-full rounded-xl bg-white py-2.5 text-[15px] font-bold text-[#03091B] disabled:opacity-60"
                                onClick={() => void submit()}
                                disabled={submitting}
                            >
                                {submitting ? 'Sending…' : 'Submit'}
                            </button>
                        </>
                    ) : null}

                    {draft.phase === 'done' ? (
                        <>
                            <p className="mb-4 text-[15px] leading-6 text-slate-200">
                                Thanks for reporting. We will review this post. {author} is not told who reported it.
                            </p>
                            {safety ? <p className="mb-3 text-sm text-amber-200">{safety}</p> : null}
                            <p className="mb-1 text-base font-semibold text-white">
                                While you wait, you can hide it from your feed.
                            </p>
                            {request.onHide ? (
                                <ChoiceButton
                                    label={doneActions.includes('hide') ? 'Post hidden' : 'Hide post'}
                                    onClick={() => void runAction('hide')}
                                />
                            ) : null}
                            {request.onMute ? (
                                <ChoiceButton
                                    label={doneActions.includes('mute') ? `Muted ${author}` : `Mute ${author}`}
                                    onClick={() => void runAction('mute')}
                                />
                            ) : null}
                            {request.onBlock ? (
                                <ChoiceButton
                                    label={doneActions.includes('block') ? `Blocked ${author}` : `Block ${author}`}
                                    danger
                                    onClick={() => void runAction('block')}
                                />
                            ) : null}
                            {actionError ? <p className="mt-2 text-sm text-red-300">{actionError}</p> : null}
                            <button
                                type="button"
                                className="mt-4 w-full rounded-xl bg-white py-2.5 text-[15px] font-bold text-[#03091B]"
                                onClick={onClose}
                            >
                                Done
                            </button>
                        </>
                    ) : null}
                </div>
            </div>
        </div>,
        document.body,
    );
}

function ChoiceButton({
    label,
    onClick,
    danger,
}: {
    label: string;
    onClick: () => void;
    danger?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex w-full items-center justify-between border-b border-white/10 py-3.5 text-left text-base ${
                danger ? 'text-red-300' : 'text-white'
            }`}
        >
            <span>{label}</span>
            <span aria-hidden="true" className="text-white/40">
                ›
            </span>
        </button>
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

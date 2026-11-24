import { apiRequest } from './client';
import { isLaravelApiEnabled } from '../config/runtimeEnv';

export type ReportPostReason =
    | 'spam'
    | 'harassment'
    | 'hate'
    | 'violence'
    | 'nudity'
    | 'misinformation'
    | 'other';

const REASON_LABELS: Record<ReportPostReason, string> = {
    spam: 'Spam',
    harassment: 'Harassment or bullying',
    hate: 'Hate speech',
    violence: 'Violence or dangerous acts',
    nudity: 'Nudity or sexual content',
    misinformation: 'False information',
    other: 'Something else',
};

export function getReportReasonOptions(): Array<{ id: ReportPostReason; label: string }> {
    return (Object.keys(REASON_LABELS) as ReportPostReason[]).map((id) => ({
        id,
        label: REASON_LABELS[id],
    }));
}

export function reportReasonLabel(reason: ReportPostReason): string {
    return REASON_LABELS[reason];
}

export type ReportPostAnswer = {
    question: string;
    answer: string;
    choiceId: string;
};

export async function reportPost(
    postId: string,
    reason: ReportPostReason = 'other',
    details?: string,
    answers?: ReportPostAnswer[],
): Promise<void> {
    if (!isLaravelApiEnabled()) {
        return;
    }
    await apiRequest(`/posts/${encodeURIComponent(postId)}/report`, {
        method: 'POST',
        body: JSON.stringify({
            reason,
            details: details?.trim() || undefined,
            answers: answers && answers.length > 0 ? answers : undefined,
        }),
    });
}

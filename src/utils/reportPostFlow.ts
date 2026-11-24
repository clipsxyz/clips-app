import {
    reportReasonLabel,
    type ReportPostAnswer,
    type ReportPostReason,
} from '../api/reports';

export type ReportChoice = {
    id: string;
    label: string;
};

export type ReportFollowUp = {
    id: string;
    question: string;
    choices: ReportChoice[];
};

const FOLLOW_UPS: Record<ReportPostReason, ReportFollowUp[]> = {
    spam: [
        {
            id: 'spam_kind',
            question: 'What kind of spam is this?',
            choices: [
                { id: 'misleading_link', label: 'Misleading or spam link' },
                { id: 'repetitive', label: 'Repetitive posting' },
                { id: 'fake_engagement', label: 'Fake engagement' },
                { id: 'other', label: 'Something else' },
            ],
        },
    ],
    harassment: [
        {
            id: 'target',
            question: 'Who is this targeting?',
            choices: [
                { id: 'me', label: 'Me' },
                { id: 'someone_i_know', label: 'Someone I know' },
                { id: 'public_figure', label: 'A public figure' },
                { id: 'someone_else', label: 'Someone else' },
            ],
        },
        {
            id: 'harassment_kind',
            question: 'How is it harassment?',
            choices: [
                { id: 'bullying', label: 'Bullying' },
                { id: 'threats', label: 'Threats' },
                { id: 'unwanted_contact', label: 'Unwanted contact' },
                { id: 'other', label: 'Something else' },
            ],
        },
    ],
    hate: [
        {
            id: 'hate_target',
            question: 'Who is being attacked?',
            choices: [
                { id: 'race', label: 'Race or ethnicity' },
                { id: 'religion', label: 'Religion' },
                { id: 'gender', label: 'Gender' },
                { id: 'sexuality', label: 'Sexual orientation' },
                { id: 'disability', label: 'Disability' },
                { id: 'other', label: 'Something else' },
            ],
        },
    ],
    violence: [
        {
            id: 'violence_kind',
            question: 'What kind of violence is this?',
            choices: [
                { id: 'threat', label: 'Threat of violence' },
                { id: 'graphic', label: 'Graphic violence' },
                { id: 'dangerous', label: 'Dangerous act' },
                { id: 'other', label: 'Something else' },
            ],
        },
    ],
    nudity: [
        {
            id: 'nudity_kind',
            question: 'What kind of content is this?',
            choices: [
                { id: 'adult_nudity', label: 'Adult nudity' },
                { id: 'sexual', label: 'Sexual content' },
                { id: 'minor', label: 'Involves a minor' },
                { id: 'other', label: 'Something else' },
            ],
        },
    ],
    misinformation: [
        {
            id: 'misinfo_kind',
            question: 'What is false?',
            choices: [
                { id: 'health', label: 'Health' },
                { id: 'civic', label: 'Politics or elections' },
                { id: 'scam', label: 'Scam or fraud' },
                { id: 'altered', label: 'Altered photo or video' },
                { id: 'other', label: 'Something else' },
            ],
        },
    ],
    other: [
        {
            id: 'other_kind',
            question: 'What is wrong with this post?',
            choices: [
                { id: 'intellectual_property', label: 'Intellectual property' },
                { id: 'self_harm', label: 'Suicide or self-injury' },
                { id: 'other', label: 'Something else' },
            ],
        },
    ],
};

export type ReportDraft = {
    phase: 'reason' | 'follow' | 'summary' | 'done';
    reason: ReportPostReason | null;
    followIndex: number;
    answers: ReportPostAnswer[];
};

export const initialReportDraft: ReportDraft = {
    phase: 'reason',
    reason: null,
    followIndex: 0,
    answers: [],
};

export function followUpsFor(reason: ReportPostReason): ReportFollowUp[] {
    return FOLLOW_UPS[reason];
}

export function currentFollowUp(draft: ReportDraft): ReportFollowUp | null {
    if (draft.phase !== 'follow' || !draft.reason) return null;
    return followUpsFor(draft.reason)[draft.followIndex] ?? null;
}

export function pickReportReason(reason: ReportPostReason): ReportDraft {
    if (followUpsFor(reason).length === 0) {
        return { phase: 'summary', reason, followIndex: 0, answers: [] };
    }
    return { phase: 'follow', reason, followIndex: 0, answers: [] };
}

export function pickReportChoice(draft: ReportDraft, choice: ReportChoice): ReportDraft {
    const step = currentFollowUp(draft);
    if (!step || !draft.reason) return draft;
    const answers = [
        ...draft.answers,
        { question: step.question, answer: choice.label, choiceId: choice.id },
    ];
    const next = draft.followIndex + 1;
    if (next < followUpsFor(draft.reason).length) {
        return { ...draft, followIndex: next, answers };
    }
    return { ...draft, phase: 'summary', answers };
}

export function goBackInReport(draft: ReportDraft): ReportDraft {
    if (draft.phase === 'done' || draft.phase === 'reason' || !draft.reason) return initialReportDraft;
    const steps = followUpsFor(draft.reason);
    if (draft.phase === 'summary') {
        if (steps.length === 0) return initialReportDraft;
        return {
            ...draft,
            phase: 'follow',
            followIndex: steps.length - 1,
            answers: draft.answers.slice(0, -1),
        };
    }
    if (draft.followIndex <= 0) return initialReportDraft;
    return {
        ...draft,
        followIndex: draft.followIndex - 1,
        answers: draft.answers.slice(0, -1),
    };
}

export function reportDetailsText(answers: ReportPostAnswer[], note: string): string {
    const lines = answers.map((row) => `${row.question}: ${row.answer}`);
    const extra = note.trim();
    if (extra) lines.push(`Note: ${extra}`);
    return lines.join('\n').slice(0, 2000);
}

export function reportSummaryRows(draft: ReportDraft): string[] {
    if (!draft.reason) return [];
    return [reportReasonLabel(draft.reason), ...draft.answers.map((row) => row.answer)];
}

/** Shown with the summary when the report is about a child or someone in danger. */
export function reportSafetyNote(draft: ReportDraft): string | null {
    const ids = new Set(draft.answers.map((row) => row.choiceId));
    if (draft.reason === 'nudity' && ids.has('minor')) {
        return 'If a child is in danger, contact local law enforcement.';
    }
    if ((draft.reason === 'other' && ids.has('self_harm')) || (draft.reason === 'violence' && ids.has('threat'))) {
        return 'If someone is in immediate danger, contact local emergency services.';
    }
    return null;
}

export function reportAuthorLabel(handle?: string | null): string {
    const clean = String(handle || '').replace(/^@/, '').trim();
    return clean ? `@${clean}` : 'this account';
}

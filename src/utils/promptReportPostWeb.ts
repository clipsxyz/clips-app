import Swal from 'sweetalert2';
import { bottomSheet } from './swalBottomSheet';
import { showToast } from './toast';
import { getReportReasonOptions, reportPost, type ReportPostReason } from '../api/reports';

export async function promptReportPostWeb(postId: string): Promise<void> {
    const options = getReportReasonOptions();
    const inputOptions: Record<string, string> = {};
    for (const o of options) {
        inputOptions[o.id] = o.label;
    }

    const result = await Swal.fire(
        bottomSheet({
            title: 'Report post',
            message: 'Why are you reporting this post?',
            icon: 'alert',
            input: 'select',
            inputOptions,
            inputPlaceholder: 'Select a reason',
            showCancelButton: true,
            confirmButtonText: 'Submit report',
            cancelButtonText: 'Cancel',
        }),
    );

    if (!result.isConfirmed || !result.value) return;

    try {
        await reportPost(postId, result.value as ReportPostReason);
        showToast('Thanks for reporting. We will review this content.');
    } catch {
        showToast('Thanks for reporting.');
    }
}

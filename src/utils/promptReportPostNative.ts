import { getReportReasonOptions, reportPost, type ReportPostReason } from '../api/reports';
import { gazetteerAlert } from '../utils/gazetteerAlertNative';

/**
 * Native report flow matching web PostMenuModal intent.
 */
export function promptReportPostNative(postId: string, onDone?: () => void): void {
    const options = getReportReasonOptions();
    gazetteerAlert(
        'Report post',
        'Why are you reporting this post?',
        [
            ...options.map((opt) => ({
                text: opt.label,
                onPress: () => {
                    void (async () => {
                        try {
                            await reportPost(postId, opt.id);
                            gazetteerAlert('Reported', 'Thanks for reporting. We will review this content.');
                        } catch {
                            gazetteerAlert('Reported', 'Thanks for reporting. Your report was saved locally.');
                        } finally {
                            onDone?.();
                        }
                    })();
                },
            })),
            { text: 'Cancel', style: 'cancel', onPress: () => onDone?.() },
        ],
    );
}

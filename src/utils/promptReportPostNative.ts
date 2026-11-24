import { openReportPost, type ReportPostRequest } from './reportPostSession';

export function promptReportPostNative(
    postIdOrRequest: string | Omit<ReportPostRequest, 'id'>,
    onDone?: () => void,
): void {
    const request = typeof postIdOrRequest === 'string' ? { postId: postIdOrRequest } : postIdOrRequest;
    openReportPost(request);
    onDone?.();
}

import { openReportPost, type ReportPostRequest } from './reportPostSession';

export function promptReportPostWeb(postIdOrRequest: string | Omit<ReportPostRequest, 'id'>): void {
    const request = typeof postIdOrRequest === 'string' ? { postId: postIdOrRequest } : postIdOrRequest;
    openReportPost(request);
}

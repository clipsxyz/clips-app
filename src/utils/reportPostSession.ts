export type ReportPostRequest = {
    id: number;
    postId: string;
    authorHandle?: string;
    onHide?: () => void | Promise<void>;
    onMute?: () => void | Promise<void>;
    onBlock?: () => void | Promise<void>;
};

type Listener = (request: ReportPostRequest | null) => void;

let nextId = 1;
let pending: ReportPostRequest | null = null;
const listeners = new Set<Listener>();

export function subscribeReportPost(listener: Listener): () => void {
    listeners.add(listener);
    if (pending) listener(pending);
    return () => {
        listeners.delete(listener);
    };
}

export function openReportPost(request: Omit<ReportPostRequest, 'id'>): void {
    pending = { ...request, id: nextId++ };
    listeners.forEach((listener) => listener(pending));
}

export function closeReportPost(id: number): void {
    if (pending?.id !== id) return;
    pending = null;
    listeners.forEach((listener) => listener(null));
}

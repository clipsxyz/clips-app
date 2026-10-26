import type { ChatMessage } from '../api/messages';

/** Optimistic send ids: `Date.now()` plus optional media suffix. */
const OPTIMISTIC_ID = /^\d+(-img|-sticker|-audio)?$/;

function sameHandle(a?: string, b?: string): boolean {
    return (a || '').replace(/^@/, '').trim().toLowerCase() === (b || '').replace(/^@/, '').trim().toLowerCase();
}

function durableId(id?: string): boolean {
    const s = String(id || '').trim();
    if (!s || s === 'undefined' || s === 'null') return false;
    return !OPTIMISTIC_ID.test(s);
}

function bodyKey(m: ChatMessage): string {
    return [(m.text || '').trim(), m.imageUrl || '', m.audioUrl || '', m.sourcePostId || ''].join('\u0001');
}

/** Same server row, or the optimistic send that the realtime echo is replacing. */
export function isSameChatMessage(a: ChatMessage, b: ChatMessage, windowMs = 8000): boolean {
    const aId = String(a.id || '').trim();
    const bId = String(b.id || '').trim();
    if (aId && bId && aId === bId && aId !== 'undefined' && aId !== 'null') return true;
    if (!sameHandle(a.senderHandle, b.senderHandle)) return false;
    const body = bodyKey(a);
    if (!body || body !== bodyKey(b)) return false;
    return Math.abs((a.timestamp || 0) - (b.timestamp || 0)) <= windowMs;
}

function mergePreferringServer(existing: ChatMessage, incoming: ChatMessage): ChatMessage {
    const preferIncoming = durableId(incoming.id) && !durableId(existing.id);
    const keep = preferIncoming ? incoming : existing;
    const other = preferIncoming ? existing : incoming;
    return {
        ...other,
        ...keep,
        id: durableId(incoming.id) ? incoming.id : existing.id,
        replyTo: incoming.replyTo ?? existing.replyTo,
        imageUrl: incoming.imageUrl ?? existing.imageUrl,
        audioUrl: incoming.audioUrl ?? existing.audioUrl,
        text: incoming.text ?? existing.text,
        sourcePostId: incoming.sourcePostId ?? existing.sourcePostId,
        read: Boolean(existing.read || incoming.read),
    };
}

/** Collapse duplicate ids / matching sender+body+time, preferring the server UUID. */
export function dedupeChatMessages(list: ChatMessage[]): ChatMessage[] {
    const out: ChatMessage[] = [];
    for (const msg of list) {
        const idx = out.findIndex((m) => isSameChatMessage(m, msg));
        if (idx < 0) {
            out.push(msg);
            continue;
        }
        out[idx] = mergePreferringServer(out[idx], msg);
    }
    return out.sort((a, b) => a.timestamp - b.timestamp);
}

export function upsertChatMessage(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
    return dedupeChatMessages([...list, incoming]);
}

export interface ChatMessage {
    id: string;
    senderHandle: string;
    text?: string;
    imageUrl?: string;
    timestamp: number;
    isSystemMessage?: boolean;
    postId?: string; // For comment notifications - the post that was commented on
    commentId?: string; // For comment notifications - the comment ID
    commentText?: string; // For comment notifications - the comment text
}

type ConversationId = string; // sorted `${a}|${b}`

const conversations = new Map<ConversationId, ChatMessage[]>();
// Track unread counts by recipient handle
const unreadByHandle = new Map<string, number>();
// Track per-thread last read timestamps per user: `${user}::${other}` => timestamp
const lastReadByThread = new Map<string, number>();

function getConversationId(a: string, b: string): ConversationId {
    return [a, b].sort((x, y) => x.localeCompare(y)).join('|');
}

export async function fetchConversation(a: string, b: string): Promise<ChatMessage[]> {
    const id = getConversationId(a, b);
    return conversations.get(id)?.slice().sort((m1, m2) => m2.timestamp - m1.timestamp) || [];
}

export async function appendMessage(from: string, to: string, message: Omit<ChatMessage, 'id' | 'timestamp' | 'senderHandle'> & { timestamp?: number }): Promise<ChatMessage> {
    const id = getConversationId(from, to);
    const list = conversations.get(id) || [];
    const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderHandle: from,
        text: message.text,
        imageUrl: message.imageUrl,
        isSystemMessage: message.isSystemMessage,
        timestamp: message.timestamp ?? Date.now(),
        postId: message.postId, // Preserve postId for comment notifications
        commentId: message.commentId, // Preserve commentId for comment notifications
        commentText: message.commentText // Preserve commentText for comment notifications
    };
    list.push(msg);
    conversations.set(id, list);
    // Recompute unread for receiver across all threads
    unreadByHandle.set(to, await computeUnreadTotal(to));

    // Create notifications for stickers and replies (only if not a system message)
    if (!message.isSystemMessage && message.text) {
        // Dynamically import to avoid circular dependency
        const { createNotification, isStickerMessage, isReplyToPost } = await import('./notifications');
        if (isStickerMessage(message.text)) {
            await createNotification({
                type: 'sticker',
                fromHandle: from,
                toHandle: to,
                message: message.text
            });
        } else if (isReplyToPost(message.text)) {
            await createNotification({
                type: 'reply',
                fromHandle: from,
                toHandle: to,
                message: message.text
            });
        }
    }

    // Dispatch events so UI can update/notify
    window.dispatchEvent(new CustomEvent('conversationUpdated', { detail: { participants: [from, to], message: msg } }));
    window.dispatchEvent(new CustomEvent('inboxUnreadChanged', { detail: { handle: to, unread: unreadByHandle.get(to) || 0 } }));
    return msg;
}

export async function appendSystemNotice(to: string, from: string, text: string): Promise<void> {
    await appendMessage(from, to, { text, isSystemMessage: true });
}

export async function getUnreadTotal(handle: string): Promise<number> {
    return unreadByHandle.get(handle) || 0;
}

export async function markConversationRead(selfHandle: string, otherHandle: string): Promise<void> {
    const key = `${selfHandle}::${otherHandle}`;
    lastReadByThread.set(key, Date.now());
    unreadByHandle.set(selfHandle, await computeUnreadTotal(selfHandle));
    window.dispatchEvent(new CustomEvent('inboxUnreadChanged', { detail: { handle: selfHandle, unread: unreadByHandle.get(selfHandle) || 0 } }));
}

export interface ConversationSummary {
    otherHandle: string;
    lastMessage?: ChatMessage;
    unread: number;
}

export async function listConversations(forHandle: string): Promise<ConversationSummary[]> {
    const summaries = new Map<string, { last?: ChatMessage; unread: number }>();
    conversations.forEach((msgs, id) => {
        const [a, b] = id.split('|');
        if (a !== forHandle && b !== forHandle) return;
        const other = a === forHandle ? b : a;
        const sorted = msgs.slice().sort((m1, m2) => m2.timestamp - m1.timestamp);
        const last = sorted[0];
        const lastRead = lastReadByThread.get(`${forHandle}::${other}`) || 0;
        const unread = sorted.filter(m => m.senderHandle !== forHandle && m.timestamp > lastRead && !m.isSystemMessage).length;
        const existing = summaries.get(other) || { last: undefined, unread: 0 };
        const betterLast = !existing.last || (last && last.timestamp > existing.last.timestamp) ? last : existing.last;
        summaries.set(other, { last: betterLast, unread });
    });
    return Array.from(summaries.entries()).map(([otherHandle, v]) => ({ otherHandle, lastMessage: v.last, unread: v.unread }))
        .sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
}

async function computeUnreadTotal(handle: string): Promise<number> {
    let total = 0;
    conversations.forEach((msgs, id) => {
        const [a, b] = id.split('|');
        if (a !== handle && b !== handle) return;
        const other = a === handle ? b : a;
        const lastRead = lastReadByThread.get(`${handle}::${other}`) || 0;
        total += msgs.filter(m => m.senderHandle !== handle && m.timestamp > lastRead && !m.isSystemMessage).length;
    });
    return total;
}


// Dev helper: seed a few mock DMs to a user
const seededFor = new Set<string>();
export async function seedMockDMs(forHandle: string): Promise<void> {
    if (!forHandle || seededFor.has(forHandle)) return;
    const mocks = [
        { from: 'Sarah@artane', text: 'Hey Barry! Loved your last clip 👏' },
        { from: 'Liam@cork', text: 'Up for a collab this week?' },
        { from: 'Ava@galway', text: 'That sunset shot was unreal 🌅' },
        { from: 'Noah@london', text: 'DM me when you’re free 👍' },
    ];
    for (const m of mocks) {
        await appendMessage(m.from, forHandle, { text: m.text });
    }
    seededFor.add(forHandle);
}


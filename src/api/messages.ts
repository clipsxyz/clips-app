export interface ChatMessage {
    id: string;
    senderHandle: string;
    text?: string;
    imageUrl?: string;
    audioUrl?: string; // For voice/audio messages
    timestamp: number;
    isSystemMessage?: boolean;
    postId?: string; // For comment notifications - the post that was commented on
    commentId?: string; // For comment notifications - the comment ID
    commentText?: string; // For comment notifications - the comment text
    replyTo?: { messageId: string; text: string; senderHandle: string; imageUrl?: string; mediaType?: 'image' | 'video' }; // Reply to another message; imageUrl = thumbnail/media URL, mediaType for video screenshot
}

type ConversationId = string; // sorted `${a}|${b}`

const conversations = new Map<ConversationId, ChatMessage[]>();
// Track unread counts by recipient handle
const unreadByHandle = new Map<string, number>();
// Track per-thread last read timestamps per user: `${user}::${other}` => timestamp
const lastReadByThread = new Map<string, number>();
// Track pinned conversations per user: userHandle => Set<otherHandle>
const pinnedConversations = new Map<string, Set<string>>();
// Track message requests per user: userHandle => Set<senderHandle>
const messageRequests = new Map<string, Set<string>>();

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
        audioUrl: message.audioUrl, // Support audio messages
        isSystemMessage: message.isSystemMessage,
        timestamp: message.timestamp ?? Date.now(),
        postId: message.postId, // Preserve postId for comment notifications
        commentId: message.commentId, // Preserve commentId for comment notifications
        commentText: message.commentText, // Preserve commentText for comment notifications
        replyTo: message.replyTo // Preserve replyTo data
    };
    list.push(msg);
    conversations.set(id, list);
    // Recompute unread for receiver across all threads
    unreadByHandle.set(to, await computeUnreadTotal(to));

    // Create notifications for all messages (only if not a system message)
    if (!message.isSystemMessage && message.text) {
        // Dynamically import to avoid circular dependency
        const { createNotification, isStickerMessage, isReplyToPost } = await import('./notifications');
        
        // Determine notification type
        let notificationType: 'sticker' | 'reply' | 'dm';
        if (isStickerMessage(message.text)) {
            notificationType = 'sticker';
        } else if (isReplyToPost(message.text)) {
            notificationType = 'reply';
        } else {
            notificationType = 'dm';
        }
        
        // Create notification for receiver only (they received a message)
        await createNotification({
            type: notificationType,
            fromHandle: from,
            toHandle: to,
            message: message.text
        });
    }

    // Dispatch events via Socket.IO (with fallback to Custom Events)
    const { emitMessage, emitInboxUnreadChanged } = await import('../services/socketio');
    emitMessage(from, to, msg);
    emitInboxUnreadChanged(to, unreadByHandle.get(to) || 0);
    
    // Also dispatch Custom Events as fallback for compatibility
    window.dispatchEvent(new CustomEvent('conversationUpdated', { detail: { participants: [from, to], message: msg } }));
    window.dispatchEvent(new CustomEvent('inboxUnreadChanged', { detail: { handle: to, unread: unreadByHandle.get(to) || 0 } }));
    return msg;
}

export async function appendSystemNotice(to: string, from: string, text: string): Promise<void> {
    await appendMessage(from, to, { text, isSystemMessage: true });
}

// Edit an existing message
export async function editMessage(messageId: string, newText: string, from: string, to: string): Promise<ChatMessage | null> {
    const id = getConversationId(from, to);
    const list = conversations.get(id) || [];
    const messageIndex = list.findIndex(msg => msg.id === messageId);
    
    if (messageIndex === -1) {
        return null; // Message not found
    }
    
    // Only allow editing your own messages
    if (list[messageIndex].senderHandle !== from) {
        throw new Error('Cannot edit messages from other users');
    }
    
    // Update the message
    const updatedMessage: ChatMessage = {
        ...list[messageIndex],
        text: newText,
        // Mark as edited (we'll add this to the interface if needed)
    };
    
    list[messageIndex] = updatedMessage;
    conversations.set(id, list);
    
    // Dispatch event for UI update
    window.dispatchEvent(new CustomEvent('conversationUpdated', { detail: { participants: [from, to], message: updatedMessage } }));
    
    return updatedMessage;
}

export async function getUnreadTotal(handle: string): Promise<number> {
    return unreadByHandle.get(handle) || 0;
}

export async function markConversationRead(selfHandle: string, otherHandle: string): Promise<void> {
    const key = `${selfHandle}::${otherHandle}`;
    lastReadByThread.set(key, Date.now());
    unreadByHandle.set(selfHandle, await computeUnreadTotal(selfHandle));
    const { emitInboxUnreadChanged } = await import('../services/socketio');
    emitInboxUnreadChanged(selfHandle, unreadByHandle.get(selfHandle) || 0);
    window.dispatchEvent(new CustomEvent('inboxUnreadChanged', { detail: { handle: selfHandle, unread: unreadByHandle.get(selfHandle) || 0 } }));
}

export interface ConversationSummary {
    otherHandle: string;
    lastMessage?: ChatMessage;
    unread: number;
    isPinned?: boolean;
    isRequest?: boolean; // True if this is a message request from a non-follower
    hasUnviewedStories?: boolean; // True if the other user has unviewed stories
    isFollowing?: boolean; // True if current user is following the other user
}

export async function listConversations(forHandle: string): Promise<ConversationSummary[]> {
    const summaries = new Map<string, { last?: ChatMessage; unread: number; isRequest?: boolean }>();
    const pinned = pinnedConversations.get(forHandle) || new Set<string>();
    const requests = messageRequests.get(forHandle) || new Set<string>();
    
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
        const isRequest = requests.has(other);
        summaries.set(other, { last: betterLast, unread, isRequest });
    });
    
    // Check for unviewed stories and follow status for each conversation
    const { userHasUnviewedStoriesByHandle } = await import('./stories');
    const { getFollowedUsers } = await import('./posts');
    
    // Get current user's followed users (need userId - will be passed from component)
    // For now, we'll check follow status in the component where we have userId
    const allConversations = await Promise.all(
        Array.from(summaries.entries()).map(async ([otherHandle, v]) => {
            const hasUnviewedStories = await userHasUnviewedStoriesByHandle(otherHandle);
            return {
                otherHandle,
                lastMessage: v.last,
                unread: v.unread,
                isPinned: pinned.has(otherHandle),
                isRequest: v.isRequest || false,
                hasUnviewedStories
            };
        })
    );
    
    // Sort: pinned first, then by timestamp
    return allConversations.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0);
    });
}

// Pin/unpin conversation
export async function pinConversation(userHandle: string, otherHandle: string): Promise<void> {
    const pinned = pinnedConversations.get(userHandle) || new Set<string>();
    pinned.add(otherHandle);
    pinnedConversations.set(userHandle, pinned);
    const { emitConversationUpdate } = await import('../services/socketio');
    emitConversationUpdate({ participants: [userHandle, otherHandle], updateType: 'pin' });
    window.dispatchEvent(new CustomEvent('conversationUpdated'));
}

export async function unpinConversation(userHandle: string, otherHandle: string): Promise<void> {
    const pinned = pinnedConversations.get(userHandle);
    if (pinned) {
        pinned.delete(otherHandle);
        pinnedConversations.set(userHandle, pinned);
        const { emitConversationUpdate } = await import('../services/socketio');
        emitConversationUpdate({ participants: [userHandle, otherHandle], updateType: 'unpin' });
        window.dispatchEvent(new CustomEvent('conversationUpdated'));
    }
}

// Add message request (when non-follower sends a message)
export async function addMessageRequest(recipientHandle: string, senderHandle: string): Promise<void> {
    const requests = messageRequests.get(recipientHandle) || new Set<string>();
    requests.add(senderHandle);
    messageRequests.set(recipientHandle, requests);
    window.dispatchEvent(new CustomEvent('conversationUpdated'));
}

// Accept message request (when user accepts/follows)
export async function acceptMessageRequest(userHandle: string, otherHandle: string): Promise<void> {
    const requests = messageRequests.get(userHandle);
    if (requests) {
        requests.delete(otherHandle);
        messageRequests.set(userHandle, requests);
        const { emitConversationUpdate } = await import('../services/socketio');
        emitConversationUpdate({ participants: [userHandle, otherHandle], updateType: 'accept' });
        window.dispatchEvent(new CustomEvent('conversationUpdated'));
    }
}

// Track muted conversations per user: userHandle => Set<otherHandle>
const mutedConversations = new Map<string, Set<string>>();

// Track blocked users per user: userHandle => Set<blockedHandle>
const blockedUsers = new Map<string, Set<string>>();

// Mute/unmute conversation notifications
export async function muteConversation(userHandle: string, otherHandle: string): Promise<void> {
    const muted = mutedConversations.get(userHandle) || new Set<string>();
    muted.add(otherHandle);
    mutedConversations.set(userHandle, muted);
    window.dispatchEvent(new CustomEvent('conversationUpdated'));
}

export async function unmuteConversation(userHandle: string, otherHandle: string): Promise<void> {
    const muted = mutedConversations.get(userHandle);
    if (muted) {
        muted.delete(otherHandle);
        mutedConversations.set(userHandle, muted);
        const { emitConversationUpdate } = await import('../services/socketio');
        emitConversationUpdate({ participants: [userHandle, otherHandle], updateType: 'unmute' });
        window.dispatchEvent(new CustomEvent('conversationUpdated'));
    }
}

export async function isConversationMuted(userHandle: string, otherHandle: string): Promise<boolean> {
    const muted = mutedConversations.get(userHandle);
    return muted ? muted.has(otherHandle) : false;
}

// Block/unblock user
export async function blockUser(userHandle: string, blockedHandle: string): Promise<void> {
    const blocked = blockedUsers.get(userHandle) || new Set<string>();
    blocked.add(blockedHandle);
    blockedUsers.set(userHandle, blocked);
    
    // Also delete the conversation when blocking
    const id = getConversationId(userHandle, blockedHandle);
    conversations.delete(id);
    
    // Remove from pinned if pinned
    const pinned = pinnedConversations.get(userHandle);
    if (pinned) {
        pinned.delete(blockedHandle);
    }
    
    // Remove from muted if muted
    const muted = mutedConversations.get(userHandle);
    if (muted) {
        muted.delete(blockedHandle);
    }
    
    // Recompute unread
    unreadByHandle.set(userHandle, await computeUnreadTotal(userHandle));
    
    window.dispatchEvent(new CustomEvent('conversationUpdated'));
}

export async function unblockUser(userHandle: string, blockedHandle: string): Promise<void> {
    const blocked = blockedUsers.get(userHandle);
    if (blocked) {
        blocked.delete(blockedHandle);
        blockedUsers.set(userHandle, blocked);
        const { emitConversationUpdate } = await import('../services/socketio');
        emitConversationUpdate({ participants: [userHandle, blockedHandle], updateType: 'unblock' });
        window.dispatchEvent(new CustomEvent('conversationUpdated'));
    }
}

export async function isUserBlocked(userHandle: string, otherHandle: string): Promise<boolean> {
    const blocked = blockedUsers.get(userHandle);
    return blocked ? blocked.has(otherHandle) : false;
}

// Delete conversation
export async function deleteConversation(userHandle: string, otherHandle: string): Promise<void> {
    const id = getConversationId(userHandle, otherHandle);
    conversations.delete(id);
    
    // Remove from pinned if pinned
    const pinned = pinnedConversations.get(userHandle);
    if (pinned) {
        pinned.delete(otherHandle);
    }
    
    // Remove from muted if muted
    const muted = mutedConversations.get(userHandle);
    if (muted) {
        muted.delete(otherHandle);
    }
    
    // Recompute unread
    unreadByHandle.set(userHandle, await computeUnreadTotal(userHandle));
    
    const { emitConversationUpdate, emitInboxUnreadChanged } = await import('../services/socketio');
    emitConversationUpdate({ participants: [userHandle, otherHandle], updateType: 'delete' });
    emitInboxUnreadChanged(userHandle, unreadByHandle.get(userHandle) || 0);
    window.dispatchEvent(new CustomEvent('conversationUpdated'));
    window.dispatchEvent(new CustomEvent('inboxUnreadChanged', { detail: { handle: userHandle, unread: unreadByHandle.get(userHandle) || 0 } }));
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


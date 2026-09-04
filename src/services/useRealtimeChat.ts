import { useEffect } from 'react';
import type { ChatMessage } from '../api/messages';
import { laravelMsgToChatMessage } from '../api/messages';
import { connectEcho, getEcho } from './echo';

function mergeIncoming(prev: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
    if (prev.some((item) => String(item.id) === String(incoming.id))) {
        return prev;
    }
    return [...prev, incoming];
}

type Options = {
    enabled: boolean;
    userId?: string | null;
    peerHandle?: string | null;
    chatGroupId?: string | null;
    isGroupThread: boolean;
    onMessage: (message: ChatMessage) => void;
};

/**
 * Subscribe to Reverb private channels for the open 1:1 or group thread.
 */
export function useRealtimeChat({
    enabled,
    userId,
    peerHandle,
    chatGroupId,
    isGroupThread,
    onMessage,
}: Options): void {
    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;
        const channelName =
            isGroupThread && chatGroupId
                ? `chat.group.${chatGroupId}`
                : userId
                  ? `chat.user.${userId}`
                  : null;
        const echoRef = { current: null as ReturnType<typeof getEcho> };

        const handlePayload = (payload: Record<string, unknown>) => {
            if (cancelled || !payload?.id) return;
            if (isGroupThread) {
                if (String(payload.chat_group_id || '') !== String(chatGroupId || '')) return;
            } else {
                if (payload.chat_group_id) return;
                const sender = String(payload.sender_handle || '');
                const recipient = String(payload.recipient_handle || '');
                const peer = String(peerHandle || '');
                if (peer && sender !== peer && recipient !== peer) return;
            }
            onMessage(laravelMsgToChatMessage(payload as Parameters<typeof laravelMsgToChatMessage>[0]));
        };

        void (async () => {
            if (!channelName) return;
            const echo = await connectEcho();
            if (cancelled || !echo) return;
            echoRef.current = echo;
            echo.private(channelName).listen('.MessageSent', handlePayload);
        })();

        return () => {
            cancelled = true;
            if (!channelName) return;
            try {
                echoRef.current?.leave(channelName);
            } catch {
                /* ignore */
            }
        };
    }, [enabled, userId, peerHandle, chatGroupId, isGroupThread, onMessage]);
}

export { mergeIncoming as mergeRealtimeChatMessage };

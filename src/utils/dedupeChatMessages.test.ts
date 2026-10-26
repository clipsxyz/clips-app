import { describe, expect, it } from 'vitest';
import { dedupeChatMessages, isSameChatMessage, upsertChatMessage } from './dedupeChatMessages';
import type { ChatMessage } from '../api/messages';

const msg = (partial: Partial<ChatMessage> & Pick<ChatMessage, 'id' | 'senderHandle'>): ChatMessage => ({
    timestamp: 1_700_000_000_000,
    text: 'hey',
    ...partial,
});

describe('dedupeChatMessages', () => {
    it('collapses the same server id', () => {
        const a = msg({ id: 'uuid-1', senderHandle: 'Debs@Manchester' });
        const b = msg({ id: 'uuid-1', senderHandle: 'Debs@Manchester', text: 'hey' });
        expect(dedupeChatMessages([a, b])).toHaveLength(1);
    });

    it('replaces an optimistic send with the realtime echo', () => {
        const optimistic = msg({
            id: '1793028000000',
            senderHandle: 'Gazetteer@Dublin',
            text: 'on my way',
            timestamp: 1793028000000,
        });
        const echo = msg({
            id: '254ffcc4-64a7-49de-8734-c33d63845c91',
            senderHandle: 'Gazetteer@Dublin',
            text: 'on my way',
            timestamp: 1793028000400,
        });
        expect(isSameChatMessage(optimistic, echo)).toBe(true);
        const merged = upsertChatMessage([optimistic], echo);
        expect(merged).toHaveLength(1);
        expect(merged[0].id).toBe(echo.id);
        expect(merged[0].text).toBe('on my way');
    });

    it('does not merge two different texts from the same sender', () => {
        const a = msg({ id: '1', senderHandle: 'Debs@Manchester', text: 'one', timestamp: 10 });
        const b = msg({ id: '2', senderHandle: 'Debs@Manchester', text: 'two', timestamp: 20 });
        expect(dedupeChatMessages([a, b])).toHaveLength(2);
    });
});

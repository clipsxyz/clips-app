import { describe, expect, it } from 'vitest';
import { groupSenderColor, groupSenderLabel, isGroupSenderRunStart } from './groupThreadSender';

describe('group thread sender labels', () => {
    it('keeps one color for the same handle', () => {
        expect(groupSenderColor('Gavin@CA')).toBe(groupSenderColor('gavin@ca'));
        expect(groupSenderColor('Gavin@CA')).not.toBe(groupSenderColor('Trent66@Liverpool'));
    });

    it('shows the name only when a different person starts speaking', () => {
        expect(
            isGroupSenderRunStart({
                isGroup: true,
                isFromMe: false,
                senderHandle: 'Trent66@Liverpool',
                previous: { senderHandle: 'Gavin@CA', isFromMe: false },
            }),
        ).toBe(true);
        expect(
            isGroupSenderRunStart({
                isGroup: true,
                isFromMe: false,
                senderHandle: 'Trent66@Liverpool',
                previous: { senderHandle: 'Trent66@Liverpool', isFromMe: false },
            }),
        ).toBe(false);
        expect(
            isGroupSenderRunStart({
                isGroup: true,
                isFromMe: true,
                senderHandle: 'Gavin@CA',
                previous: null,
            }),
        ).toBe(false);
        expect(groupSenderLabel('Gavin@CA')).toBe('Gavin@CA');
    });
});
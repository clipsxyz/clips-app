import { describe, expect, it } from 'vitest';
import { groupInvitePresentation } from './groupInviteNotification';

describe('groupInvitePresentation', () => {
    it('names the inviter and the group from dedicated fields', () => {
        expect(
            groupInvitePresentation({
                fromHandle: 'Gavin@CA',
                fromDisplayName: 'Barry Lawlor',
                groupName: 'The lads',
                message: 'Gavin@CA invited you to join The lads',
            }),
        ).toEqual({
            title: 'Barry Lawlor',
            handle: 'Gavin@CA',
            showHandle: true,
            groupName: 'The lads',
        });
    });

    it('reads the group name out of the invite sentence when the field is missing', () => {
        expect(
            groupInvitePresentation({
                fromHandle: 'Gavin@CA',
                message: 'Gavin@CA invited you to join The lads',
            }).groupName,
        ).toBe('The lads');
    });
});
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/runtimeEnv', async (importOriginal) => {
    const runtimeEnv = await importOriginal<typeof import('../config/runtimeEnv')>();
    return { ...runtimeEnv, isLaravelApiEnabled: () => false };
});

import {
    createNotification,
    getUnreadNotificationCount,
    markAllNotificationsRead,
} from './notifications';

describe('inbox notification unread count', () => {
    beforeEach(async () => {
        await markAllNotificationsRead('Barry@Dublin');
    });

    it('clears the footer count after mark all as read', async () => {
        await createNotification({
            type: 'like',
            fromHandle: 'Alice@Cork',
            toHandle: 'Barry@Dublin',
            message: 'liked your post',
        });
        await createNotification({
            type: 'follow',
            fromHandle: 'Diana@Limerick',
            toHandle: 'Barry@Dublin',
            message: 'started following you',
        });
        await createNotification({
            type: 'comment',
            fromHandle: 'Charlie@Galway',
            toHandle: 'Barry@Dublin',
            message: 'Nice shot!',
        });

        expect(await getUnreadNotificationCount('Barry@Dublin')).toBe(3);

        await markAllNotificationsRead('Barry@Dublin');

        expect(await getUnreadNotificationCount('Barry@Dublin')).toBe(0);
    });
});

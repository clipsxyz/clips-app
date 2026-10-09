import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { userHasStoriesByHandleMock, userHasUnviewedStoriesByHandleMock } = vi.hoisted(() => ({
    userHasStoriesByHandleMock: vi.fn(),
    userHasUnviewedStoriesByHandleMock: vi.fn(),
}));

vi.mock('../api/stories', () => ({
    userHasStoriesByHandle: userHasStoriesByHandleMock,
    userHasUnviewedStoriesByHandle: userHasUnviewedStoriesByHandleMock,
}));

import { useHasActiveStories } from './useHasActiveStories';

/**
 * The active-story ring feeds the feed header avatar and the quick-menu "View stories"
 * row. The hook must never restart its probe (or a network call) because the parent
 * passes a fresh inline `onHasStoryChange` callback every render — that identity churn
 * was the classic "Maximum update depth exceeded" driver.
 */
describe('useHasActiveStories', () => {
    beforeEach(() => {
        userHasStoriesByHandleMock.mockReset();
        userHasUnviewedStoriesByHandleMock.mockReset();
        userHasStoriesByHandleMock.mockResolvedValue(false);
        userHasUnviewedStoriesByHandleMock.mockResolvedValue(false);
    });

    it('runs one probe and reports the unviewed ring to the callback once', async () => {
        const onChange = vi.fn();
        const { result } = renderHook(() =>
            useHasActiveStories('Alice@Dublin', {
                viewerId: 'v1',
                isCurrentUser: false,
                onHasStoryChange: onChange,
            }),
        );

        await waitFor(() => expect(result.current).toBe(false));
        expect(userHasStoriesByHandleMock).toHaveBeenCalledTimes(1);
        expect(userHasUnviewedStoriesByHandleMock).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(false);
    });

    it('does not re-probe or re-report when configured with a fresh inline callback each render', async () => {
        const { rerender } = renderHook(() =>
            useHasActiveStories('Alice@Dublin', {
                viewerId: 'v1',
                isCurrentUser: false,
                onHasStoryChange: () => {},
            }),
        );

        await waitFor(() => expect(userHasStoriesByHandleMock).toHaveBeenCalledTimes(1));

        rerender();
        rerender();
        await waitFor(() =>
            expect(userHasStoriesByHandleMock).toHaveBeenCalledTimes(1),
        );
        expect(userHasUnviewedStoriesByHandleMock).toHaveBeenCalledTimes(1);
    });

    it('re-probes when the handle changes and reports the new value', async () => {
        const onChange = vi.fn();
        const { result, rerender } = renderHook(
            (props: { handle: string }) =>
                useHasActiveStories(props.handle, {
                    viewerId: 'v1',
                    isCurrentUser: false,
                    onHasStoryChange: onChange,
                }),
            { initialProps: { handle: 'Alice@Dublin' } },
        );

        await waitFor(() => expect(userHasStoriesByHandleMock).toHaveBeenCalledTimes(1));

        userHasStoriesByHandleMock.mockResolvedValue(true);
        userHasUnviewedStoriesByHandleMock.mockResolvedValue(true);
        rerender({ handle: 'Barry@Galway' });

        await waitFor(() => expect(result.current).toBe(true));
        expect(userHasStoriesByHandleMock).toHaveBeenCalledTimes(2);
        expect(onChange).toHaveBeenCalledWith(true);
    });
});
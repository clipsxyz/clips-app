import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const { userHasStoriesByHandleMock, userHasUnviewedStoriesByHandleMock } = vi.hoisted(() => ({
    userHasStoriesByHandleMock: vi.fn(),
    userHasUnviewedStoriesByHandleMock: vi.fn(),
}));

vi.mock('../api/stories', () => ({
    userHasStoriesByHandle: userHasStoriesByHandleMock,
    userHasUnviewedStoriesByHandle: userHasUnviewedStoriesByHandleMock,
}));

import { markStoryAsViewed, resetStoryViewedStore } from '../utils/storyViewedStore';
import { useHasActiveStories, useHasUnseenStory, useStoryRingState } from './useHasActiveStories';

/**
 * The active-story ring feeds the feed header avatar and the quick-menu "View stories"
 * row. The hook must never restart its probe (or a network call) because the parent
 * passes a fresh inline `onHasStoryChange` callback every render — that identity churn
 * was the classic "Maximum update depth exceeded" driver.
 */
describe('useHasActiveStories', () => {
    beforeEach(() => {
        resetStoryViewedStore();
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

    it('keeps the legacy boolean contract: current user rings on any story, others on unviewed', async () => {
        userHasStoriesByHandleMock.mockResolvedValue(true);
        userHasUnviewedStoriesByHandleMock.mockResolvedValue(false);

        const { result: own } = renderHook(() =>
            useHasActiveStories('Alice@Dublin', { viewerId: 'v1', isCurrentUser: true }),
        );
        await waitFor(() => expect(own.current).toBe(true));

        const { result: other } = renderHook(() =>
            useHasActiveStories('Alice@Dublin', { viewerId: 'v1', isCurrentUser: false }),
        );
        await waitFor(() => expect(other.current).toBe(false));
    });
});

describe('useHasUnseenStory', () => {
    beforeEach(() => {
        resetStoryViewedStore();
        userHasStoriesByHandleMock.mockReset();
        userHasUnviewedStoriesByHandleMock.mockReset();
        userHasStoriesByHandleMock.mockResolvedValue(false);
        userHasUnviewedStoriesByHandleMock.mockResolvedValue(false);
    });

    it('drops the gradient as soon as markStoryAsViewed fires for that user', async () => {
        userHasStoriesByHandleMock.mockResolvedValue(true);
        userHasUnviewedStoriesByHandleMock.mockResolvedValue(true);

        const { result } = renderHook(() =>
            useHasUnseenStory('Dana@Kerry', { viewerId: 'v1', isCurrentUser: false }),
        );

        await waitFor(() => expect(result.current).toBe(true));
        act(() => {
            markStoryAsViewed('story-dana', 'Dana@Kerry');
        });
        await waitFor(() => expect(result.current).toBe(false));
    });

    it('uses initialUnseen without probing when enabled is false', async () => {
        const { result } = renderHook(() =>
            useHasUnseenStory('Eve@Limerick', {
                initialUnseen: true,
                enabled: false,
            }),
        );

        await waitFor(() => expect(result.current).toBe(true));
        expect(userHasStoriesByHandleMock).not.toHaveBeenCalled();
        act(() => {
            markStoryAsViewed('', 'Eve@Limerick');
        });
        await waitFor(() => expect(result.current).toBe(false));
    });

    it('clears an inbox-style short handle when the full handle is marked viewed', async () => {
        const { result } = renderHook(() =>
            useHasUnseenStory('Barry@Galway', {
                initialUnseen: true,
                enabled: false,
            }),
        );

        await waitFor(() => expect(result.current).toBe(true));
        act(() => {
            markStoryAsViewed('story-barry', 'Barry');
        });
        await waitFor(() => expect(result.current).toBe(false));
    });
});

describe('useStoryRingState', () => {
    beforeEach(() => {
        resetStoryViewedStore();
        userHasStoriesByHandleMock.mockReset();
        userHasUnviewedStoriesByHandleMock.mockReset();
        userHasStoriesByHandleMock.mockResolvedValue(false);
        userHasUnviewedStoriesByHandleMock.mockResolvedValue(false);
    });

    it('reports the unseen (white) ring when stories are unviewed', async () => {
        userHasStoriesByHandleMock.mockResolvedValue(true);
        userHasUnviewedStoriesByHandleMock.mockResolvedValue(true);

        const { result } = renderHook(() =>
            useStoryRingState('Alice@Dublin', { viewerId: 'v1', isCurrentUser: false }),
        );

        await waitFor(() => expect(result.current.state).toBe('unseen'));
        expect(result.current.hasStory).toBe(true);
        expect(result.current.hasUnviewed).toBe(true);
    });

    it('reports the seen (grey) ring when every story was viewed', async () => {
        userHasStoriesByHandleMock.mockResolvedValue(true);
        userHasUnviewedStoriesByHandleMock.mockResolvedValue(false);

        const { result } = renderHook(() =>
            useStoryRingState('Alice@Dublin', { viewerId: 'v1', isCurrentUser: false }),
        );

        await waitFor(() => expect(result.current.state).toBe('seen'));
        expect(result.current.hasStory).toBe(true);
        expect(result.current.hasUnviewed).toBe(false);
    });

    it('reports the none ring when there are no active stories', async () => {
        const { result } = renderHook(() =>
            useStoryRingState('Alice@Dublin', { viewerId: 'v1', isCurrentUser: false }),
        );

        await waitFor(() => expect(userHasStoriesByHandleMock).toHaveBeenCalledTimes(1));
        expect(result.current.state).toBe('none');
        expect(result.current.hasStory).toBe(false);
    });
});
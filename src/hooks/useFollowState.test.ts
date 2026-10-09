import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
    useFollowState,
    emitFollowStatusChanged,
    onFollowStatusChanged,
    clearFollowStatusCache,
    type FollowStatusPayload,
} from './useFollowState';

/**
 * The follow-state bus keeps feed headers / quick menus / DM gates in sync after a
 * follow or unfollow happens on View Profile (or anywhere) without a feed refetch.
 * Matching is by normalized handle; the last emission per handle is cached so
 * components mounted later still read the fresh value.
 */
describe('useFollowState', () => {
    beforeEach(() => {
        clearFollowStatusCache();
    });

    it('falls back to props when no broadcast has been seen', () => {
        const { result } = renderHook(() =>
            useFollowState({ handle: 'Barry@Galway', isFollowing: true, hasPendingRequest: false }),
        );
        expect(result.current).toEqual({ isFollowing: true, hasPendingRequest: false });
    });

    it('updates subscribers when a matching handle is broadcast', () => {
        const { result } = renderHook(() =>
            useFollowState({ userId: 'u1', handle: 'Barry@Galway', isFollowing: true }),
        );
        expect(result.current.isFollowing).toBe(true);

        act(() => {
            emitFollowStatusChanged({
                userId: 'u1',
                handle: 'Barry@Galway',
                isFollowing: false,
                hasPendingRequest: false,
            });
        });

        expect(result.current.isFollowing).toBe(false);
    });

    it('matches handles case-insensitively and ignores a leading @', () => {
        const { result } = renderHook(() =>
            useFollowState({ handle: 'barry@galway', isFollowing: true }),
        );

        act(() => {
            emitFollowStatusChanged({
                handle: '@Barry@Galway',
                isFollowing: false,
            });
        });

        expect(result.current.isFollowing).toBe(false);
    });

    it('ignores broadcasts for a different handle', () => {
        const { result } = renderHook(() =>
            useFollowState({ handle: 'Barry@Galway', isFollowing: true }),
        );

        act(() => {
            emitFollowStatusChanged({ handle: 'Alice@Dublin', isFollowing: false });
        });

        expect(result.current.isFollowing).toBe(true);
    });

    it('ignores a handle match whose userId conflicts', () => {
        const { result } = renderHook(() =>
            useFollowState({ userId: 'u1', handle: 'Barry@Galway', isFollowing: true }),
        );

        act(() => {
            emitFollowStatusChanged({
                userId: 'someone-else',
                handle: 'Barry@Galway',
                isFollowing: false,
            });
        });

        expect(result.current.isFollowing).toBe(true);
    });

    it('seeds from the latest cached broadcast on a later mount', () => {
        emitFollowStatusChanged({
            handle: 'Barry@Galway',
            isFollowing: false,
            hasPendingRequest: false,
        });

        const { result } = renderHook(() =>
            useFollowState({ handle: 'Barry@Galway', isFollowing: true }),
        );

        expect(result.current.isFollowing).toBe(false);
    });

    it('tracks a pending request as well as following', () => {
        const { result } = renderHook(() =>
            useFollowState({ handle: 'Private@Cork', isFollowing: false, hasPendingRequest: false }),
        );

        act(() => {
            emitFollowStatusChanged({
                handle: 'Private@Cork',
                isFollowing: false,
                hasPendingRequest: true,
            });
        });

        expect(result.current).toEqual({ isFollowing: false, hasPendingRequest: true });
    });

    it('stops receiving updates after unsubscribe', () => {
        const seen: FollowStatusPayload[] = [];
        const unsubscribe = onFollowStatusChanged((payload) => seen.push(payload));

        emitFollowStatusChanged({ handle: 'Barry@Galway', isFollowing: false });
        unsubscribe();
        emitFollowStatusChanged({ handle: 'Barry@Galway', isFollowing: true });

        expect(seen).toHaveLength(1);
        expect(seen[0].isFollowing).toBe(false);
    });

    it('does not notify for an empty handle', () => {
        const seen: FollowStatusPayload[] = [];
        onFollowStatusChanged((payload) => seen.push(payload));

        emitFollowStatusChanged({ handle: '   ', isFollowing: true });

        expect(seen).toHaveLength(0);
    });
});
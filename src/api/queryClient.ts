import { QueryClient } from '@tanstack/react-query';

/** Shared React Query client — 5m staleTime cuts refetch-on-focus noise. */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
        },
    },
});

export const queryKeys = {
    notifications: (handle: string) => ['notifications', handle] as const,
    conversations: (handle: string) => ['conversations', handle] as const,
    unreadBadge: (handle: string) => ['unread-badge', handle] as const,
    userProfile: (handle: string) => ['user-profile', handle] as const,
    storyGroup: (handle: string) => ['story-group', handle] as const,
    homeFeed: (filter: string, viewerUserId: string, viewerHandle?: string) =>
        ['home-feed', filter, viewerUserId, viewerHandle || ''] as const,
};

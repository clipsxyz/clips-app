import React, { useCallback, useState } from 'react';
import { InteractionManager, StatusBar } from 'react-native';
import type { Post } from '../types';
import { useAuth } from '../context/Auth';
import ScenesViewer from '../components/ScenesViewer.native';
import { setFeedVideoHandoff } from '../utils/feedScenesHandoffNative';
import { flushScenesPostUpdates, setScenesPostUpdate } from '../utils/scenesPostSyncNative';
import { ox } from '../constants/nativeOpticalScale';

type RouteParams = {
    initialPostId: string;
    posts: Post[];
    initialVideoTime?: number;
    initialMuted?: boolean;
    feedLabel?: string;
};

function scenesPostNeedsFeedSync(prev: Post | undefined, next: Post): boolean {
    if (!prev) return true;
    return (
        prev.isLiked !== next.isLiked ||
        prev.isFollowing !== next.isFollowing ||
        prev.text !== next.text ||
        prev.stats?.likes !== next.stats?.likes ||
        prev.stats?.comments !== next.stats?.comments ||
        prev.stats?.shares !== next.stats?.shares ||
        prev.stats?.views !== next.stats?.views ||
        prev.stats?.reclips !== next.stats?.reclips
    );
}

export default function ScenesScreen({ route, navigation }: any) {
    const { user } = useAuth();
    const params = route.params as RouteParams;
    const [posts, setPosts] = useState<Post[]>(params.posts ?? []);

    const handleClose = useCallback(
        (savedTime?: number, postId?: string, mutedState?: boolean) => {
            const initialById = new Map(
                (params.posts ?? []).map((p) => [String(p.id), p] as const),
            );
            for (const p of posts) {
                if (scenesPostNeedsFeedSync(initialById.get(String(p.id)), p)) {
                    setScenesPostUpdate(p);
                }
            }
            if (postId != null) {
                setFeedVideoHandoff(postId, {
                    currentTime: Math.max(0, savedTime ?? 0),
                    muted: mutedState ?? params.initialMuted ?? true,
                    fromScenes: true,
                });
            }
            // Pop first, then sync feed — flushing before goBack remeasures FlatList
            // mid-transition and makes the return scroll jump.
            navigation.goBack();
            InteractionManager.runAfterInteractions(() => {
                flushScenesPostUpdates();
            });
        },
        [navigation, params.initialMuted, params.posts, posts],
    );

    return (
        <>
            <StatusBar barStyle="light-content" />
            <ScenesViewer
                posts={posts}
                initialPostId={params.initialPostId}
                initialVideoTime={params.initialVideoTime}
                initialMuted={params.initialMuted}
                feedLabel={params.feedLabel}
                viewerUserId={user?.id ?? 'anon'}
                viewerHandle={user?.handle}
                viewerAvatarUrl={user?.avatarUrl}
                onClose={handleClose}
                onVisitProfile={(handle) =>
                    navigation.navigate('ViewProfile', { handle })
                }
                onPostsChange={setPosts}
                navigation={navigation}
                onBoost={() => navigation.navigate('Boost')}
            />
        </>
    );
}

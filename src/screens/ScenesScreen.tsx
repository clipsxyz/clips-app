import React, { useCallback, useRef, useState } from 'react';
import { InteractionManager, StatusBar } from 'react-native';
import type { Post } from '../types';
import { useAuth } from '../context/Auth';
import ScenesViewer from '../components/ScenesViewer.native';
import { setFeedVideoHandoff, peekFeedVideoHandoff } from '../utils/feedScenesHandoffNative';
import { getScenesLaunchPayload, clearScenesLaunchPayload } from '../utils/scenesLaunchNative';
import { getLocalPostById } from '../api/posts';
import { flushScenesPostUpdates, setScenesPostUpdate } from '../utils/scenesPostSyncNative';

type RouteParams = {
    initialPostId: string;
    posts?: Post[];
    initialVideoTime?: number;
    initialMuted?: boolean;
    feedLabel?: string;
};

function resolveScenesPosts(params: RouteParams): Post[] {
    const launch = getScenesLaunchPayload();
    const initialPostId = String(launch?.initialPostId || params.initialPostId || '');
    const fromLaunch =
        launch && (!launch.initialPostId || String(launch.initialPostId) === initialPostId)
            ? launch.posts
            : undefined;
    let posts = (fromLaunch?.length ? fromLaunch : params.posts) ?? [];
    if (posts.length === 0 && initialPostId) {
        const local = getLocalPostById(initialPostId);
        if (local) posts = [local];
    }
    const handoff = peekFeedVideoHandoff(initialPostId);
    if (handoff?.mediaUrl) {
        posts = posts.map((p) => {
            if (String(p.id) !== initialPostId) return p;
            if (p.mediaUrl) return p;
            return { ...p, mediaUrl: handoff.mediaUrl, mediaType: p.mediaType || 'video' };
        });
    }
    return posts;
}

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
    const launch = getScenesLaunchPayload();
    const initialPostId = String(launch?.initialPostId || params.initialPostId || '');
    const initialVideoTime = launch?.initialVideoTime ?? params.initialVideoTime;
    const initialMuted = launch?.initialMuted ?? params.initialMuted;
    const feedLabel = launch?.feedLabel ?? params.feedLabel;
    const [posts, setPosts] = useState<Post[]>(() => resolveScenesPosts(params));
    const openingPostsRef = useRef(posts);

    const handleClose = useCallback(
        (savedTime?: number, postId?: string, mutedState?: boolean) => {
            const initialById = new Map(
                openingPostsRef.current.map((p) => [String(p.id), p] as const),
            );
            for (const p of posts) {
                if (scenesPostNeedsFeedSync(initialById.get(String(p.id)), p)) {
                    setScenesPostUpdate(p);
                }
            }
            if (postId != null) {
                setFeedVideoHandoff(postId, {
                    currentTime: Math.max(0, savedTime ?? 0),
                    muted: mutedState ?? initialMuted ?? true,
                    fromScenes: true,
                });
            }
            clearScenesLaunchPayload();
            navigation.goBack();
            InteractionManager.runAfterInteractions(() => {
                flushScenesPostUpdates();
            });
        },
        [initialMuted, navigation, posts],
    );

    return (
        <>
            <StatusBar barStyle="light-content" />
            <ScenesViewer
                posts={posts}
                initialPostId={initialPostId}
                initialVideoTime={initialVideoTime}
                initialMuted={initialMuted}
                feedLabel={feedLabel}
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

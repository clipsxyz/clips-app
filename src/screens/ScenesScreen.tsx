import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'react-native';
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
        prev.userLiked !== next.userLiked ||
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

    /**
     * Real-time engagement sync. Likes/follows made in the viewer must reach the host the
     * moment they happen, not only when the route closes — Scenes can sit on top of other
     * routes for a long while, and every other surface reading the shared store (the feed
     * card, the still viewer, PostDetail, CollectionFeed) would otherwise keep the pre-Scenes
     * count until `handleClose` runs. Doubles as the baseline for the close-time backstop,
     * which only has to push whatever changed after the last live flush (e.g. on the final
     * frame); flushing an already-empty queue is a no-op.
     */
    const syncedPostsRef = useRef(posts);
    useEffect(() => {
        let changed = false;
        for (const p of posts) {
            const prev = syncedPostsRef.current.find((q) => String(q.id) === String(p.id));
            if (scenesPostNeedsFeedSync(prev, p)) {
                setScenesPostUpdate(p);
                changed = true;
            }
        }
        syncedPostsRef.current = posts;
        if (changed) flushScenesPostUpdates();
    }, [posts]);

    const handleClose = useCallback(
        (savedTime?: number, postId?: string, mutedState?: boolean) => {
            const lastSyncedById = new Map(
                syncedPostsRef.current.map((p) => [String(p.id), p] as const),
            );
            for (const p of posts) {
                if (scenesPostNeedsFeedSync(lastSyncedById.get(String(p.id)), p)) {
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
            // Apply any last-frame patches before the feed paints again. A deferred flush
            // left the card on the numbers from before the modal opened.
            flushScenesPostUpdates();
            navigation.goBack();
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

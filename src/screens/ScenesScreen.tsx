import React, { useCallback, useRef, useState } from 'react';
import { InteractionManager, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { Post } from '../types';
import { useAuth } from '../context/Auth';
import ScenesViewer from '../components/ScenesViewer.native';
import { setFeedVideoHandoff, peekFeedVideoHandoff } from '../utils/feedScenesHandoffNative';
import { getScenesLaunchPayload, clearScenesLaunchPayload } from '../utils/scenesLaunchNative';
import { stopScenesPlayback } from '../utils/feedScenesPlaybackNative';
import { haltFeedPlayback } from '../utils/feedActiveVideoNative';
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
        prev.userReclipped !== next.userReclipped ||
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
    const [originRect] = useState(() => launch?.originRect ?? null);
    const [posts, setPosts] = useState<Post[]>(() => resolveScenesPosts(params));
    const openingPostsRef = useRef(posts);

    /**
     * Stop everything this screen is responsible for playing, synchronously.
     *
     * Two players can be alive at once and they are not interchangeable:
     *
     *  - `stopScenesPlayback` silences the viewer's own ExoPlayer, which lives
     *    in this screen and is NOT in the feed's single-player slot store
     *    (registering it there let the feed's scheduler pause it out from under
     *    the user — see `feedScenesPlaybackNative`).
     *  - `haltFeedPlayback` releases the feed card's slot so the destination
     *    screen can claim it. Without this the profile screen mounts while the
     *    feed still holds `activePostId`, and its own videos are refused by
     *    `setActiveFeedVideoPostId`'s `if (next && !playbackAllowed)` guard.
     *
     * Called from the blur effect below AND inline before each navigation, so
     * the teardown happens even if focus handling is late or the navigation is
     * dispatched from inside a gesture worklet.
     */
    const teardownPlayback = useCallback(() => {
        stopScenesPlayback();
        haltFeedPlayback();
    }, []);

    /**
     * Safety net for every exit that is not an explicit `teardownPlayback`
     * call: swipe-down dismiss, hardware back, `goBack()` from `handleClose`,
     * and the viewer's own `navigation.navigate('Messages', …)`.
     *
     * `ScenesScreen` is a real navigation screen, so losing focus is a
     * reliable signal — unlike the old `Modal`-based overlay, where presenting
     * it never blurred the feed and the halt never fired at all.
     */
    useFocusEffect(
        useCallback(() => teardownPlayback, [teardownPlayback]),
    );

    const navigateAway = useCallback(
        (routeName: string, routeParams?: object) => {
            teardownPlayback();
            navigation.navigate(routeName, routeParams);
        },
        [navigation, teardownPlayback],
    );

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
                const closed = posts.find((p) => String(p.id) === String(postId));
                setFeedVideoHandoff(postId, {
                    currentTime: Math.max(0, savedTime ?? 0),
                    muted: mutedState ?? initialMuted ?? true,
                    fromScenes: true,
                    mediaUrl: closed?.mediaUrl,
                });
            }
            clearScenesLaunchPayload();
            // Stop before going back: the feed resumes on focus, and it should
            // reclaim the slot from a stopped player rather than a live one.
            teardownPlayback();
            navigation.goBack();
            InteractionManager.runAfterInteractions(() => {
                flushScenesPostUpdates();
            });
        },
        [initialMuted, navigation, posts, teardownPlayback],
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
                originRect={originRect}
                viewerUserId={user?.id ?? 'anon'}
                viewerHandle={user?.handle}
                viewerAvatarUrl={user?.avatarUrl}
                onClose={handleClose}
                onVisitProfile={(handle) => navigateAway('ViewProfile', { handle })}
                onPostsChange={setPosts}
                navigation={{ navigate: (r: string, p?: object) => navigateAway(r, p) }}
                onBoost={() => navigateAway('Boost')}
            />
        </>
    );
}

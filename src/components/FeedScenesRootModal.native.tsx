import React, { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager, Modal, StatusBar, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/Auth';
import type { Post } from '../types';
import { setFeedVideoHandoff } from '../utils/feedScenesHandoffNative';
import { haltFeedPlayback } from '../utils/feedActiveVideoNative';
import { stopScenesPlayback } from '../utils/feedScenesPlaybackNative';
import { resetFeedExpandForNavigation } from '../utils/feedFullscreenExpandNative';
import {
    getFeedScenesOverlaySession,
    setFeedScenesOverlaySession,
    subscribeFeedScenesOverlaySession,
} from '../utils/feedScenesOverlayNative';
import { flushScenesPostUpdates, setScenesPostUpdate } from '../utils/scenesPostSyncNative';
import ScenesViewer from './ScenesViewer.native';

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

/**
 * Fullscreen Scenes in its own native window (Modal). A sibling View cannot
 * paint above Android native-stack screens — that left feed chrome visible.
 */
export default function FeedScenesRootModal() {
    const { user } = useAuth();
    const [session, setSession] = useState(() => getFeedScenesOverlaySession());
    const [sessionKey, setSessionKey] = useState<string | null>(
        session ? String(session.postId) : null,
    );
    const [posts, setPosts] = useState<Post[]>(() => session?.posts ?? []);
    const openingPostsRef = useRef<Post[]>(session?.posts ?? []);
    const navigateRef = useRef(session?.navigate);

    useEffect(() => subscribeFeedScenesOverlaySession(setSession), []);

    const nextSessionKey = session ? String(session.postId) : null;
    if (nextSessionKey !== sessionKey) {
        setSessionKey(nextSessionKey);
        setPosts(session?.posts ?? []);
        openingPostsRef.current = session?.posts ?? [];
        navigateRef.current = session?.navigate;
    }

    const closeOverlay = useCallback(
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
                    muted: mutedState ?? session?.muted ?? true,
                    fromScenes: true,
                    mediaUrl: closed?.mediaUrl,
                });
            }
            setFeedScenesOverlaySession(null);
            InteractionManager.runAfterInteractions(() => {
                flushScenesPostUpdates();
            });
        },
        [posts, session?.muted],
    );

    const isExpanded = Boolean(session);
    const startPostId = session ? String(session.postId) : '';
    const viewerPosts = (posts.length > 0 ? posts : session?.posts) ?? [];
    const hasStartPost = Boolean(
        startPostId && viewerPosts.some((p) => String(p.id) === startPostId),
    );

    /**
     * Every navigation out of this overlay runs through here, and all three
     * steps are synchronous and ordered — no `await`, no animation, no
     * deferred callback between the stop and the navigation.
     *
     * 1. `resetFeedExpandForNavigation` drops the morph so no card is left
     *    parked mid-transition behind the new screen.
     * 2. `stopScenesPlayback` silences *this overlay's* ExoPlayer. It cannot be
     *    reached through the shared store, because it lives in its own native
     *    Modal window and is not competing for the feed's slot.
     * 3. `haltFeedPlayback` clears the feed's active id, releasing the slot so
     *    the destination screen can claim it and start playing.
     *
     * Doing all three before dispatching means there is no frame in which the
     * profile screen mounts while anything is still audible underneath it.
     */
    const navigateAway = useCallback(
        (route: string, params?: object) => {
            resetFeedExpandForNavigation();
            stopScenesPlayback();
            haltFeedPlayback();
            navigateRef.current?.(route, params);
        },
        [],
    );

    return (
        <Modal
            visible={isExpanded}
            animationType="fade"
            statusBarTranslucent
            navigationBarTranslucent
            presentationStyle="fullScreen"
            hardwareAccelerated
            onRequestClose={() => closeOverlay()}
        >
            <View style={styles.root} collapsable={false}>
                <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
                {session && hasStartPost ? (
                    <ScenesViewer
                        key={startPostId}
                        posts={viewerPosts}
                        initialPostId={startPostId}
                        initialVideoTime={session.initialVideoTime}
                        initialMuted={session.muted}
                        feedLabel={session.feedLabel}
                        originRect={null}
                        viewerUserId={user?.id ?? 'anon'}
                        viewerHandle={user?.handle}
                        viewerAvatarUrl={user?.avatarUrl}
                        onClose={closeOverlay}
                        onVisitProfile={(handle) => {
                            closeOverlay();
                            navigateAway('ViewProfile', { handle });
                        }}
                        onPostsChange={setPosts}
                        navigation={{
                            navigate: (route, params) => navigateAway(route, params),
                        }}
                        onBoost={() => {
                            closeOverlay();
                            navigateAway('Boost');
                        }}
                    />
                ) : null}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
    },
});

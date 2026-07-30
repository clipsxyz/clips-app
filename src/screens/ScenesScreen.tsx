import React, { useCallback, useState } from 'react';
import { StatusBar } from 'react-native';
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

export default function ScenesScreen({ route, navigation }: any) {
    const { user } = useAuth();
    const params = route.params as RouteParams;
    const [posts, setPosts] = useState<Post[]>(params.posts ?? []);

    const handleClose = useCallback(
        (savedTime?: number, postId?: string, mutedState?: boolean) => {
            for (const p of posts) {
                setScenesPostUpdate(p);
            }
            flushScenesPostUpdates();
            if (postId != null && savedTime != null) {
                setFeedVideoHandoff(postId, {
                    currentTime: savedTime,
                    muted: mutedState ?? params.initialMuted ?? true,
                });
            }
            navigation.goBack();
        },
        [navigation, params.initialMuted, posts],
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

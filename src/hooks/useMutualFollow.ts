import { useEffect, useState } from 'react';
import type { Post } from '../types';
import { checkFollowsMe } from '../api/client';

export function useMutualFollow(post: Post, isCurrentUser: boolean): boolean {
    const [followsMeFromApi, setFollowsMeFromApi] = useState<boolean | null>(null);
    const isFollowing = post.isFollowing === true;
    const authorFollowsYou = post.authorFollowsYou === true;

    useEffect(() => {
        if (isCurrentUser || !isFollowing || authorFollowsYou) {
            setFollowsMeFromApi(null);
            return;
        }
        let cancelled = false;
        checkFollowsMe(post.userHandle)
            .then((res) => {
                if (!cancelled) setFollowsMeFromApi(res.follows_me === true);
            })
            .catch(() => {
                if (!cancelled) setFollowsMeFromApi(false);
            });
        return () => {
            cancelled = true;
        };
    }, [post.userHandle, isCurrentUser, isFollowing, authorFollowsYou]);

    return isFollowing && (authorFollowsYou || followsMeFromApi === true);
}

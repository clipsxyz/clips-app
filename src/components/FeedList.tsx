import { useRef } from 'react';
import { apiRequest } from '../api/client';

type BoostRef = { id?: number | string } | null | undefined;

type ViewablePost = {
    id?: string | number;
    boost?: BoostRef;
};

type ViewableEntry = {
    isViewable?: boolean;
    item?: ({ kind?: string; post?: ViewablePost | null } & ViewablePost) | null;
};

/**
 * Impression viewability for the home feed.
 * Video autoplay keeps its own, faster config on the same list.
 */
export function useBoostedPostViewability() {
    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 60,
        minimumViewTime: 500,
    });
    const trackedImpressionsRef = useRef(new Set<string>());

    const onViewableItemsChanged = useRef(
        ({ viewableItems }: { viewableItems?: ViewableEntry[] }) => {
            for (const token of viewableItems ?? []) {
                if (token?.isViewable === false) continue;
                const item = token?.item?.kind === 'post' ? token.item.post : token?.item;
                if (!(item?.boost && item.boost.id)) continue;

                const boostId = Number(item.boost.id);
                if (!Number.isFinite(boostId) || boostId <= 0) continue;
                const postKey = item.id != null ? String(item.id) : `boost:${boostId}`;
                if (trackedImpressionsRef.current.has(postKey)) continue;
                trackedImpressionsRef.current.add(postKey);

                void trackBoostEvent(boostId, 'impression');
                void trackBoostEvent(boostId, 'reach');
            }
        },
    ).current;

    return { viewabilityConfig, onViewableItemsChanged, trackedImpressionsRef };
}

/** Record a click, then open the post. Tracking never waits on the network. */
export function handlePostPress(
    item: { boost?: BoostRef } | null | undefined,
    openPost: () => void,
): void {
    try {
        if (item?.boost && item.boost.id) {
            const boostId = Number(item.boost.id);
            if (Number.isFinite(boostId) && boostId > 0) {
                void trackBoostEvent(boostId, 'click');
            }
        }
    } catch {
        /* A tracking failure must not block the post. */
    }
    openPost();
}

async function trackBoostEvent(boostId: number, event: 'impression' | 'reach' | 'click'): Promise<void> {
    try {
        await apiRequest(`/boosts/${boostId}/track`, {
            method: 'POST',
            body: JSON.stringify({ event }),
        });
    } catch {
        /* Tracking must never affect scrolling or navigation. */
    }
}

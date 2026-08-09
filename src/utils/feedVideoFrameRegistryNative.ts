import type { RefObject } from 'react';
import type { View } from 'react-native';

type FrameEntry = {
    ref: RefObject<View | null>;
    rawUrl: string;
    userHandle?: string;
    showScenesCta: boolean;
    onOpenScenes?: () => void;
    onToggleMute?: () => void;
};

const frames = new Map<string, FrameEntry>();

/** Feed cells register poster frames + chrome handlers. No setState on active change. */
export function registerFeedVideoFrame(postId: string, entry: FrameEntry | null): void {
    const id = String(postId);
    if (!entry) {
        frames.delete(id);
        return;
    }
    frames.set(id, entry);
}

export function getFeedVideoFrame(postId: string): FrameEntry | null {
    return frames.get(String(postId)) ?? null;
}

export function measureFeedVideoFrame(
    postId: string,
    cb: (rect: {
        x: number;
        y: number;
        width: number;
        height: number;
        rawUrl: string;
        userHandle?: string;
        showScenesCta: boolean;
        onOpenScenes?: () => void;
        onToggleMute?: () => void;
    }) => void,
): void {
    const entry = frames.get(String(postId));
    if (!entry?.ref.current) return;
    const { rawUrl, userHandle, showScenesCta, onOpenScenes, onToggleMute } = entry;
    entry.ref.current.measureInWindow((x, y, width, height) => {
        if (width < 8 || height < 8) return;
        cb({
            x,
            y,
            width,
            height,
            rawUrl,
            userHandle,
            showScenesCta,
            onOpenScenes,
            onToggleMute,
        });
    });
}

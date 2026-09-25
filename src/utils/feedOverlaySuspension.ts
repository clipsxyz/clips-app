/**
 * Feed video suspension policy.
 *
 * Heavy / full-screen sheets pause the feed video. Lightweight popovers must NOT —
 * they are transient, non-blocking affordances, and killing the clip under a quick
 * like or reaction burst is jarring. Kept in one place because two call sites in
 * FeedScreen (the `paused` prop and the resume guard) must never disagree.
 */

export type FeedOverlayState = {
    // Existing full-screen / modal overlays.
    commentsModalOpen: boolean;
    scenesViewerActive: boolean;
    scenesOverlay: boolean;
    imageFullscreenPost: boolean;

    // Heavy bottom sheets.
    shareModalOpen: boolean;
    dmSheetOpen: boolean;
    taggedSheetPost: boolean;
    gazetteerAlertOpen: boolean;
    reclipConfirmOpen: boolean;

    // Lightweight popovers — deliberately NOT suspending.
    likesSheetPost: boolean;
};

/**
 * True while a heavy / full-screen sheet is up. Mirrors the sheet terms of
 * `shouldSuspendFeedVideo` minus comments/scenes/fullscreen, which the resume
 * guard already tracks separately.
 */
export function isHeavyFeedSheetOpen(s: FeedOverlayState): boolean {
    return (
        s.shareModalOpen ||
        s.dmSheetOpen ||
        s.taggedSheetPost ||
        s.gazetteerAlertOpen ||
        s.reclipConfirmOpen
    );
}

export function shouldSuspendFeedVideo(s: FeedOverlayState): boolean {
    return (
        s.commentsModalOpen ||
        s.scenesViewerActive ||
        s.scenesOverlay ||
        s.imageFullscreenPost ||
        isHeavyFeedSheetOpen(s)
    );
}

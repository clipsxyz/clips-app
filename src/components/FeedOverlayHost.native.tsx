import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';
import { fetchComments } from '../api/posts';
import { appendMessage } from '../api/messages';
import type { Post } from '../types';
import FeedDmSheet, { type FeedDmSheetHandle } from './FeedDmSheet.native';
import FeedShareModal from './FeedShareModal';
import PlaceFeedScopePickerModal from './PlaceFeedScopePickerModal.native';
import PostCommentsSheet from './PostCommentsSheet';
import {
    closeFeedCommentsOverlay,
    closeFeedLocationPicker,
    closeFeedShareOverlay,
    getFeedOverlaySnapshot,
    registerFeedDmOpener,
    subscribeFeedOverlaySnapshot,
} from '../utils/feedOverlayStoreNative';
import {
    resolvePlaceFeedSelection,
    type PlaceFeedSelection,
} from '../utils/pickPlaceFeedScope';

type Props = {
    userHandle: string | undefined;
    updatePost: (postId: string, updater: (post: Post) => Post) => void;
    pinFeedScrollSoon: (explicitY?: number | null) => void;
    restoreFeedVideoAfterOverlay: () => void;
    applyCustomLocationFeed: (
        selection: PlaceFeedSelection,
        filterType: 'location' | 'venue' | 'landmark',
    ) => void;
    onShareSuccess: (postId: string) => void;
    feedScrollYRef: React.MutableRefObject<number>;
};

function useFeedDmComposer(viewerHandle: string | undefined) {
    const dmSheetRef = useRef<FeedDmSheetHandle>(null);
    const [dmSheetOpen, setDmSheetOpen] = useState(false);
    const [dmSheetRecipientHandle, setDmSheetRecipientHandle] = useState<string | null>(null);
    const [dmSheetAnchorPostId, setDmSheetAnchorPostId] = useState<string | null>(null);
    const [dmSheetMessage, setDmSheetMessage] = useState('');
    const [dmSheetSending, setDmSheetSending] = useState(false);
    const [pendingDmUser, setPendingDmUser] = useState<string | null>(null);
    const [pendingDmPostId, setPendingDmPostId] = useState<string | null>(null);
    const [dmSheetEpoch, setDmSheetEpoch] = useState(0);
    const dmSessionRef = useRef(0);
    const suppressDismissRef = useRef(false);
    const unlockDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const openDmThread = useCallback(
        (handle: string, postId: string, isMutual?: boolean) => {
            if (isMutual === false) {
                Alert.alert(
                    'Cannot message',
                    'You must mutually follow each other to send a direct message',
                );
                return;
            }
            const nextHandle = (handle || '').trim();
            if (!nextHandle) return;
            dmSessionRef.current += 1;
            suppressDismissRef.current = true;
            setPendingDmUser(nextHandle);
            setPendingDmPostId(postId ? String(postId) : null);
            setDmSheetRecipientHandle(nextHandle);
            setDmSheetAnchorPostId(postId ? String(postId) : null);
            setDmSheetMessage('');
            setDmSheetSending(false);
        },
        [],
    );

    useEffect(() => {
        if (!pendingDmUser) return undefined;
        const session = dmSessionRef.current;
        const t = setTimeout(() => {
            if (session !== dmSessionRef.current) return;
            setDmSheetOpen(true);
            setPendingDmUser(null);
            setPendingDmPostId(null);
            dmSheetRef.current?.present();
            if (unlockDismissTimerRef.current) clearTimeout(unlockDismissTimerRef.current);
            unlockDismissTimerRef.current = setTimeout(() => {
                if (session === dmSessionRef.current) suppressDismissRef.current = false;
            }, 400);
        }, 250);
        return () => clearTimeout(t);
    }, [pendingDmUser, pendingDmPostId]);

    const sendDmFromSheet = useCallback(async () => {
        const text = dmSheetMessage.trim();
        const recipient = dmSheetRecipientHandle;
        if (!text || !viewerHandle || !recipient || dmSheetSending) return;
        setDmSheetSending(true);
        try {
            await appendMessage(viewerHandle, recipient, {
                text,
                sourcePostId: dmSheetAnchorPostId ?? undefined,
            });
            dmSheetRef.current?.dismiss();
        } catch (err) {
            Alert.alert(
                'Could not send',
                err instanceof Error ? err.message : 'Please try again.',
            );
        } finally {
            setDmSheetSending(false);
        }
    }, [dmSheetAnchorPostId, dmSheetMessage, dmSheetRecipientHandle, dmSheetSending, viewerHandle]);

    const closeDmSheet = useCallback(() => {
        if (suppressDismissRef.current) return;
        setDmSheetOpen(false);
        setPendingDmUser(null);
        setPendingDmPostId(null);
        setDmSheetRecipientHandle(null);
        setDmSheetAnchorPostId(null);
        setDmSheetMessage('');
        setDmSheetSending(false);
        setTimeout(() => setDmSheetEpoch((n) => n + 1), 0);
    }, []);

    return {
        dmSheetRef,
        dmSheetEpoch,
        dmSheetOpen,
        dmSheetRecipientHandle,
        dmSheetMessage,
        setDmSheetMessage,
        dmSheetSending,
        openDmThread,
        sendDmFromSheet,
        closeDmSheet,
    };
}

function FeedOverlayHost({
    userHandle,
    updatePost,
    pinFeedScrollSoon,
    restoreFeedVideoAfterOverlay,
    applyCustomLocationFeed,
    onShareSuccess,
    feedScrollYRef,
}: Props) {
    const overlay = useSyncExternalStore(
        subscribeFeedOverlaySnapshot,
        getFeedOverlaySnapshot,
        getFeedOverlaySnapshot,
    );
    const {
        dmSheetRef,
        dmSheetEpoch,
        dmSheetOpen,
        dmSheetRecipientHandle,
        dmSheetMessage,
        setDmSheetMessage,
        dmSheetSending,
        openDmThread,
        sendDmFromSheet,
        closeDmSheet,
    } = useFeedDmComposer(userHandle);

    useLayoutEffect(() => registerFeedDmOpener(openDmThread), [openDmThread]);

    const commentsPost = overlay.commentsPost;
    const commentsOpen = commentsPost != null;
    const sharePost = overlay.sharePost;
    const locationPicker = overlay.locationPicker;

    const closeCommentsSheet = useCallback(() => {
        const y = feedScrollYRef.current;
        closeFeedCommentsOverlay();
        restoreFeedVideoAfterOverlay();
        pinFeedScrollSoon(y);
    }, [feedScrollYRef, pinFeedScrollSoon, restoreFeedVideoAfterOverlay]);

    return (
        <>
            <Modal
                visible={commentsOpen}
                transparent
                animationType="slide"
                statusBarTranslucent
                hardwareAccelerated
                onRequestClose={closeCommentsSheet}
                onShow={() => pinFeedScrollSoon()}
            >
                <View style={styles.fullscreenOverlayRoot}>
                    <Pressable
                        style={styles.fullscreenOverlayBackdrop}
                        onPress={closeCommentsSheet}
                        accessibilityLabel="Dismiss comments"
                    />
                    <View style={styles.fullscreenCommentsSheet}>
                        {commentsPost ? (
                            <PostCommentsSheet
                                variant="scenesEmbed"
                                postId={String(commentsPost.id)}
                                post={commentsPost}
                                isOpen={commentsOpen}
                                commentAuthorHandle={userHandle ?? ''}
                                currentUserHandle={userHandle}
                                onAfterClose={() => {
                                    const pid = String(commentsPost.id);
                                    fetchComments(pid)
                                        .then((list) =>
                                            updatePost(pid, (p) => ({
                                                ...p,
                                                stats: { ...p.stats, comments: list.length },
                                            })),
                                        )
                                        .catch(() => {});
                                }}
                                onClose={closeCommentsSheet}
                            />
                        ) : null}
                    </View>
                </View>
            </Modal>

            <FeedDmSheet
                key={dmSheetEpoch}
                ref={dmSheetRef}
                open={dmSheetOpen}
                recipientHandle={dmSheetRecipientHandle}
                message={dmSheetMessage}
                onChangeMessage={setDmSheetMessage}
                onClose={closeDmSheet}
                onSend={() => {
                    void sendDmFromSheet();
                }}
                sending={dmSheetSending}
            />

            {sharePost ? (
                <FeedShareModal
                    post={sharePost}
                    isOpen
                    onClose={() => {
                        const y = feedScrollYRef.current;
                        closeFeedShareOverlay();
                        pinFeedScrollSoon(y);
                    }}
                    onShareSuccess={onShareSuccess}
                />
            ) : null}

            {locationPicker ? (
                <PlaceFeedScopePickerModal
                    visible
                    suggestion={locationPicker.suggestion}
                    onClose={() => closeFeedLocationPicker()}
                    onSelectScope={(scope) => {
                        applyCustomLocationFeed(
                            resolvePlaceFeedSelection(locationPicker.suggestion, scope),
                            locationPicker.kind,
                        );
                        closeFeedLocationPicker();
                    }}
                />
            ) : null}
        </>
    );
}

const styles = StyleSheet.create({
    fullscreenOverlayRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    fullscreenOverlayBackdrop: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    fullscreenCommentsSheet: {
        height: Math.round(Dimensions.get('window').height * 0.78),
        backgroundColor: 'transparent',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
    },
});

export default React.memo(FeedOverlayHost);

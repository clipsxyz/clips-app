import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    Image,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Animated,
    PanResponder,
    Linking,
    PermissionsAndroid,
    ScrollView,
    DeviceEventEmitter,
    type ViewToken,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { navigateMainTab } from '../navigation/mainTabs';
import { launchImageLibrary } from 'react-native-image-picker';
import Clipboard from '@react-native-clipboard/clipboard';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { useAuth } from '../context/Auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { dedupeChatMessages, upsertChatMessage } from '../utils/dedupeChatMessages';
import {
    fetchConversationMessagesPage,
    fetchGroupThreadMessagesPage,
    appendMessage,
    appendGroupChatMessage,
    listConversations,
    markConversationRead,
    markGroupConversationReadById,
    editMessage,
    muteConversation,
    unmuteConversation,
    isConversationMuted,
    blockUser,
    unblockUser,
    isUserBlocked,
    deleteConversation,
    type ChatMessage,
} from '../api/messages';
import {
    createChatGroup,
    fetchMyChatGroups,
    inviteUserToChatGroup,
    isChatGroupAdmin,
    leaveChatGroup,
} from '../api/chatGroups';
import { connectSocket, joinGroupChat, leaveGroupChat } from '../services/socketio';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { uploadFileFromUri } from '../utils/uploadFileNative';
import { getAvatarForHandle } from '../api/users';
import { getFollowedUsers, getState, getFollowState, loadSharedPost } from '../api/posts';
import { fetchUserProfile } from '../api/client';
import { parsePlacesFromBio } from '../utils/suggestedPlaces';
import {
    extractSharedPostRef,
    sharedPostRefKey,
    type SharedPostRef,
} from '../utils/extractPostId';
import { DmSharedPostCard, DmSharedPostPreviewCard } from '../components/DmSharedPostCard.native';
import { hasPendingFollowRequest } from '../api/privacy';
import { followOrRequest } from '../utils/followOrRequest';
import type { Post } from '../types';
import { unifiedSearch } from '../api/search';
import { timeAgo } from '../utils/timeAgo';
import Avatar from '../components/Avatar';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet.native';
import PassportSheetCanvas from '../components/PassportSheetCanvas.native';
import {
    UCL_CANVAS_NAVY,
    UCL_TEXT_PLACEHOLDER,
    UCL_TEXT_PRIMARY,
} from '../theme/gazetteerAmbientNative';
import GazetteerMenuSheet, { type GazetteerMenuOption } from '../components/GazetteerMenuSheet.native';
import DmMessageActionsSheet, { type DmMessageAction } from '../components/DmMessageActionsSheet.native';
import DmReactionFlyOverlay, {
    type ReactionFlyTarget,
} from '../components/DmReactionFlyOverlay.native';
import DmMessagePressable from '../components/DmMessagePressable.native';
import DmInlineVideoMessage from '../components/DmInlineVideoMessage.native';
import IMessageDmBubbleShell from '../components/IMessageDmBubbleShell.native';
import {
    DM_SENT_BRASS,
    DM_SENT_PASSPORT,
    dmSentBubbleColor,
    dmSentBubbleGradient,
    getDmSentBubblePreference,
    setDmSentBubblePreference,
    type DmSentBubbleStyle,
} from '../constants/dmImessageTheme.native';
import { toFileUri } from '../utils/ffmpegNative';
import { ox } from '../constants/nativeOpticalScale';
import { DM_MEDIA_ASPECT_RATIO, DM_MEDIA_MAX_WIDTH } from '../constants/dmMedia.native';
import { setScenesLaunchPayload } from '../utils/scenesLaunchNative';

function sameDmHandle(a?: string | null, b?: string | null): boolean {
    return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

/** Derive a shareable post reference from a DM message (explicit id or share URL). */
function getMessageSharedRef(msg: ChatMessage): SharedPostRef | null {
    // Structured linkage first (persisted source_post_id): the message text may be
    // a user caption with no parseable link in it at all.
    if (msg.sourcePostId) return { postId: msg.sourcePostId };
    if (msg.postId) return { postId: msg.postId };
    if (msg.text) return extractSharedPostRef(msg.text);
    return null;
}

/** Normalized quoted-reply data rendered inside bubbles and the composer strip. */
type DmReplyPreview = {
    senderHandle: string;
    text: string;
    /** Canonical thumbnail/poster URI (kept in sync with `imageUrl`). */
    thumbUrl?: string;
    imageUrl?: string;
    isVideo: boolean;
};

/** First non-empty string in a candidate list, or undefined. */
function firstThumbCandidate(...values: Array<string | null | undefined>): string | undefined {
    for (const v of values) {
        if (typeof v === 'string' && v.trim().length > 0) return v;
    }
    return undefined;
}

/**
 * Resolve a thumbnail/poster for a parent message, checking EVERY source:
 * the message's own media fields (camel + snake/loose variants), then the
 * shared post's poster/thumbnail/media fields and its first slide.
 * A video file URL is never returned as the image URI — for videos the
 * poster/thumbnail wins, and `isVideo` tells the card to overlay a badge.
 */
function resolveReplyThumb(
    msg: ChatMessage | undefined,
    sharedPosts: Record<string, Post>,
): { thumbUrl?: string; imageUrl?: string; isVideo: boolean } {
    if (!msg) return { thumbUrl: undefined, isVideo: false };
    const loose = msg as unknown as Record<string, unknown>;
    const ref = getMessageSharedRef(msg);
    const post = ref ? sharedPosts[sharedPostRefKey(ref)] : undefined;
    const loosePost = post as unknown as Record<string, any> | undefined;
    const item = post?.mediaItems?.[0];
    const slide = loosePost?.slides?.[0];

    const candidates = [
        msg.imageUrl,
        loose.thumbUrl as string | undefined,
        loose.thumbnailUrl as string | undefined,
        loose.thumbnail_url as string | undefined,
        post?.videoPosterUrl,
        post?.thumbnailUrl,
        loosePost?.thumbnail_url as string | undefined,
        loosePost?.thumbnailUrl as string | undefined,
        item?.posterUrl,
        item?.thumbnailUrl,
        item?.thumbnail_url,
        slide?.posterUrl as string | undefined,
        slide?.thumbnailUrl as string | undefined,
        slide?.thumbnail_url as string | undefined,
        // Media URLs are usable only when they point at an image (checked below).
        msg.imageUrl,
        loose.mediaUrl as string | undefined,
        loose.media_url as string | undefined,
        post?.mediaUrl,
        loosePost?.media_url as string | undefined,
        item?.url,
        slide?.url as string | undefined,
    ];
    const isVideo =
        post?.mediaType === 'video' ||
        item?.type === 'video' ||
        slide?.type === 'video' ||
        candidates.some((c) => isVideoUrlString(c ?? undefined));

    // Prefer the first candidate that can actually render in an <Image>;
    // video URLs are skipped so a poster further down the list can win.
    const thumbUrl = candidates
        .map((c) => firstThumbCandidate(c))
        .find((c): c is string => !!c && !isVideoUrlString(c));
    return { thumbUrl, imageUrl: thumbUrl, isVideo };
}

/** Thumbnail/poster for a resolved shared post (poster → thumbnail → first slide). */
function thumbFromPost(post: Post | undefined): { thumbUrl?: string; isVideo: boolean } {
    if (!post) return { thumbUrl: undefined, isVideo: false };
    const loosePost = post as unknown as Record<string, any>;
    const item = post.mediaItems?.[0];
    const slide = loosePost.slides?.[0];
    const candidates = [
        post.videoPosterUrl,
        post.thumbnailUrl,
        loosePost.thumbnail_url as string | undefined,
        item?.posterUrl,
        item?.thumbnailUrl,
        item?.thumbnail_url,
        slide?.posterUrl as string | undefined,
        slide?.thumbnailUrl as string | undefined,
        slide?.thumbnail_url as string | undefined,
        post.mediaUrl,
        loosePost.media_url as string | undefined,
        item?.url,
        slide?.url as string | undefined,
    ];
    const isVideo =
        post.mediaType === 'video' ||
        item?.type === 'video' ||
        slide?.type === 'video' ||
        candidates.some((c) => isVideoUrlString(c ?? undefined));
    const thumbUrl = candidates.find(
        (c): c is string => typeof c === 'string' && c.trim().length > 0 && !isVideoUrlString(c),
    );
    return { thumbUrl, isVideo };
}

/** Compact snippet label for a quoted reply (prefers media label over raw share URLs). */
function replySnippetLabel(text: string, thumbUrl: string | undefined, isVideo: boolean): string {
    const trimmed = text.trim();
    if (thumbUrl && (!trimmed || /^https?:\/\//i.test(trimmed))) {
        return isVideo ? 'Video' : 'Photo';
    }
    return trimmed || 'Message';
}

function isVideoUrlString(url?: string): boolean {
    if (!url) return false;
    const trimmed = url.trim();
    return /^data:video\//i.test(trimmed) || /\.(mp4|webm|m4v|mov)(\?|#|$)/i.test(trimmed);
}

/** Build the quoted preview for a reply message, enriching from the parent when the payload is thin. */
function resolveReplyPreview(
    item: ChatMessage,
    messagesById: Map<string, ChatMessage>,
    sharedPosts: Record<string, Post>,
): DmReplyPreview | null {
    const replyTo = item.replyTo;
    const rawReplyId =
        replyTo?.messageId ||
        ((item as { reply_to_message_id?: string | null }).reply_to_message_id ?? undefined);
    if (!replyTo && !rawReplyId) return null;
    const parent = rawReplyId ? messagesById.get(rawReplyId) : undefined;
    const fromParent = resolveReplyThumb(parent, sharedPosts);
    // The stored payload may carry the media URL under either key; a raw video
    // URL there is not renderable, so fall through to the parent's poster.
    const payloadThumb = firstThumbCandidate(replyTo?.imageUrl, replyTo?.thumbUrl);
    // Last resort: the parent row may be outside the loaded page, but the
    // server-rehydrated quote text for a shared-post parent IS the share URL —
    // resolve the post from it directly.
    const refFromQuoteText =
        !payloadThumb && !fromParent.thumbUrl && replyTo?.text
            ? extractSharedPostRef(replyTo.text)
            : null;
    const fromQuotePost = thumbFromPost(
        refFromQuoteText ? sharedPosts[sharedPostRefKey(refFromQuoteText)] : undefined,
    );
    const thumbUrl =
        payloadThumb && !isVideoUrlString(payloadThumb)
            ? payloadThumb
            : (fromParent.thumbUrl ?? fromQuotePost.thumbUrl);
    const isVideo =
        replyTo?.mediaType === 'video' ||
        fromParent.isVideo ||
        fromQuotePost.isVideo ||
        isVideoUrlString(payloadThumb) ||
        isVideoUrlString(thumbUrl);
    return {
        senderHandle: replyTo?.senderHandle || parent?.senderHandle || '',
        text: replySnippetLabel(replyTo?.text || parent?.text || '', thumbUrl, isVideo),
        thumbUrl,
        imageUrl: thumbUrl,
        isVideo,
    };
}

/** Build the quoted preview for a message being replied to from the composer. */
function previewFromMessage(msg: ChatMessage, sharedPosts: Record<string, Post>): DmReplyPreview {
    const { thumbUrl, imageUrl, isVideo } = resolveReplyThumb(msg, sharedPosts);
    return {
        senderHandle: msg.senderHandle || '',
        text: replySnippetLabel(msg.text || '', thumbUrl, isVideo),
        thumbUrl,
        imageUrl,
        isVideo,
    };
}

/**
 * Instagram/WhatsApp-style quoted reply card. Shared by thread bubbles and the composer
 * strip so both read identically: dark translucent glass, left accent, sender + snippet.
 */
function DmQuotedReply({
    preview,
    variant = 'bubble',
}: {
    preview: DmReplyPreview;
    variant?: 'bubble' | 'composer';
}) {
    const isComposer = variant === 'composer';
    const senderLabel = preview.senderHandle ? `Replying to ${preview.senderHandle}` : 'Replying to';
    return (
        <View
            style={[
                styles.quotedReply,
                isComposer ? styles.quotedReplyComposer : styles.quotedReplyBubble,
            ]}
            testID="dm-quoted-reply"
        >
            <View style={styles.quotedReplyAccent} />
            {(() => {
                const uri = preview.imageUrl || preview.thumbUrl;
                const showImage =
                    typeof uri === 'string' && uri.trim().length > 0 && !isVideoUrlString(uri);
                if (!showImage && !preview.isVideo) return null;
                return (
                    <View
                        style={[
                            styles.quotedReplyThumb,
                            isComposer && styles.quotedReplyThumbComposer,
                        ]}
                    >
                        {showImage ? (
                            <Image
                                source={{ uri }}
                                style={styles.quotedReplyThumbImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={styles.quotedReplyVideoBadge}>
                                <Icon
                                    name="videocam"
                                    size={ox(isComposer ? 16 : 12)}
                                    color="#FFFFFF"
                                />
                            </View>
                        )}
                        {showImage && preview.isVideo ? (
                            <View style={styles.quotedReplyVideoBadgeOverlay}>
                                <Icon name="videocam" size={ox(9)} color="#FFFFFF" />
                            </View>
                        ) : null}
                    </View>
                );
            })()}
            <View style={styles.quotedReplyBody}>
                <Text style={styles.quotedReplySender} numberOfLines={1}>
                    {senderLabel}
                </Text>
                <Text style={styles.quotedReplyText} numberOfLines={1}>
                    {preview.text}
                </Text>
            </View>
        </View>
    );
}

type DmReaction = { emoji: string; users: string[] };

type DmRowHandlers = {
    openMessageActions: (item: ChatMessage) => void;
    handleToggleReaction: (messageId: string, emoji: string) => void;
    handleReactWithAnimation: (messageId: string, emoji: string) => void;
    handlePlayAudioMessage: (audioUrl?: string) => void;
    openScenesForPost: (post: Post) => void;
    openScenesForRef: (ref: SharedPostRef) => void;
    formatMessageClock: (ts: number) => string;
    isLikelyVideoUrl: (url?: string) => boolean;
};

type DmMessageRowProps = {
    message: ChatMessage;
    userHandle?: string;
    userId?: string;
    threadHandle?: string;
    isGroupThread: boolean;
    dmSentStyle: DmSentBubbleStyle;
    translatedText?: string;
    reactions?: DmReaction[];
    isPlayingAudio: boolean;
    isSwiping: boolean;
    /** Whether this row sits inside the active message viewport (drives inline video auto-pause). */
    isActive: boolean;
    /** Normalized quoted-reply data for this message, if it is a reply. */
    replyPreview: DmReplyPreview | null;
    reactionFlyEmoji: string | null;
    sharedPost: Post | null;
    swipeAnim: Animated.Value;
    navigation: any;
    setReplyingTo: (item: ChatMessage | null) => void;
    setEditingMessage: (item: ChatMessage | null) => void;
    setSwipingMessageId: (id: string | null) => void;
    swipeMessageIdRef: React.MutableRefObject<string | null>;
    reactionPillRefs: React.MutableRefObject<Record<string, View | null>>;
    handlers: React.MutableRefObject<DmRowHandlers>;
};

/**
 * Memoized DM thread row. Callbacks/refs arrive through `handlers` (a stable ref)
 * so only rows whose visible data changed re-render during thread updates.
 */
const DmMessageRow = React.memo(function DmMessageRow({
    message: item,
    userHandle,
    userId,
    threadHandle,
    isGroupThread,
    dmSentStyle,
    translatedText,
    reactions,
    isPlayingAudio,
    isSwiping,
    isActive,
    replyPreview,
    reactionFlyEmoji,
    sharedPost,
    swipeAnim,
    navigation,
    setReplyingTo,
    setEditingMessage,
    setSwipingMessageId,
    swipeMessageIdRef,
    reactionPillRefs,
    handlers,
}: DmMessageRowProps) {
    const ctx = handlers.current;
    const suppressTapRef = useRef(false);
    const isFromMe = sameDmHandle(item.senderHandle, userHandle);
    const senderAvatar = getAvatarForHandle(item.senderHandle);
    const isStoryInteraction = Boolean(item.storyId);
    const isLegacyStoryContextText =
        !!item.isSystemMessage &&
        typeof item.text === 'string' &&
        item.text.trim().toLowerCase().startsWith('replying to @') &&
        item.text.toLowerCase().includes('story');

    const entry = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.spring(entry, {
            toValue: 1,
            friction: 8,
            tension: 90,
            useNativeDriver: true,
        }).start();
    }, [entry]);
    const entryStyle = {
        opacity: entry,
        transform: [
            {
                translateY: entry.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                }),
            },
        ],
    };

    const bubblePanResponder = PanResponder.create({
        // Don't claim touch on start — that blocks long-press / reply menu.
        onStartShouldSetPanResponder: () => false,
        // Higher threshold so a soft hold (with tiny jitter) isn't stolen as a swipe.
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
            gestureState.dx > 28 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.35,
        onPanResponderGrant: () => {
            swipeMessageIdRef.current = item.id;
            swipeAnim.stopAnimation();
            swipeAnim.setValue(0);
            setSwipingMessageId(item.id);
        },
        onPanResponderMove: (_evt, gestureState) => {
            const dx = Math.max(0, Math.min(gestureState.dx, 84));
            const dy = Math.abs(gestureState.dy);
            if (dx > dy * 0.6) {
                swipeAnim.setValue(dx);
            }
        },
        onPanResponderRelease: (_evt, gestureState) => {
            // Swipe-to-reply binds the same way long-press does, for own and
            // incoming messages alike.
            const shouldReply = gestureState.dx > 48;
            Animated.spring(swipeAnim, {
                toValue: 0,
                friction: 7,
                tension: 140,
                useNativeDriver: true,
            }).start(() => {
                if (swipeMessageIdRef.current === item.id) {
                    setSwipingMessageId(null);
                    swipeMessageIdRef.current = null;
                }
            });
            if (shouldReply) {
                setReplyingTo(item);
                setEditingMessage(null);
            }
        },
        onPanResponderTerminate: () => {
            Animated.spring(swipeAnim, {
                toValue: 0,
                friction: 7,
                tension: 140,
                useNativeDriver: true,
            }).start(() => {
                setSwipingMessageId(null);
                swipeMessageIdRef.current = null;
            });
        },
    });

    const renderReactionPills = () => {
        if (!reactions?.length) return null;
        return (
            <View style={styles.reactionsRow}>
                {reactions.map((reaction) => {
                    const pillKey = `${item.id}::${reaction.emoji}`;
                    return (
                        <View
                            key={pillKey}
                            ref={(node) => {
                                reactionPillRefs.current[pillKey] = node;
                            }}
                            collapsable={false}
                            onLayout={() => {
                                if (reactionFlyEmoji === reaction.emoji) {
                                    // Pill just appeared during pop — ready to measure soon
                                }
                            }}
                        >
                            <TouchableOpacity
                                style={styles.reactionPill}
                                onPress={() => {
                                    if (suppressTapRef.current) return;
                                    ctx.handleToggleReaction(item.id, reaction.emoji);
                                }}
                            >
                                <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                                {reaction.users.length > 1 && (
                                    <Text style={styles.reactionCount}>{reaction.users.length}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    );
                })}
            </View>
        );
    };

    const onDoubleTap = () => ctx.handleReactWithAnimation(item.id, '❤️');

    let inner: React.ReactNode;

    if (isStoryInteraction || isLegacyStoryContextText) {
        const trimmed = (item.text || '').trim();
        const reactionOnly =
            !!item.storyId &&
            (item.storyContextText === 'Reacted to your story' ||
                (trimmed.length > 0 && trimmed.length <= 4 && !/\s/.test(trimmed)));
        const label = reactionOnly
            ? isFromMe
                ? 'You reacted to their story'
                : 'Reacted to your story'
            : isFromMe
              ? 'You replied to their story'
              : 'Replied to your story';
        const bodyText = reactionOnly
            ? trimmed
            : trimmed && trimmed !== 'Replied to your story'
              ? trimmed
              : item.storyContextText && item.storyContextText !== 'Reacted to your story'
                ? item.storyContextText
                : null;

        inner = (
            <>
                {!isFromMe ? (
                    <Avatar src={senderAvatar} name={item.senderHandle.split('@')[0]} size={ox(32)} />
                ) : null}
                <View style={[styles.messageColumn, isFromMe ? styles.messageColumnMe : styles.messageColumnOther]}>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                            if (!item.storyId) return;
                            navigation.navigate('Stories', {
                                openUserHandle: isFromMe
                                    ? threadHandle
                                    : item.storyContextOwner || threadHandle,
                                openStoryId: item.storyId,
                            });
                        }}
                        onLongPress={() => ctx.openMessageActions(item)}
                    >
                        <View style={[styles.storyStickerCard, isFromMe && styles.storyStickerCardMine]}>
                            {item.imageUrl ? (
                                <Image source={{ uri: item.imageUrl }} style={styles.storyStickerThumb} />
                            ) : (
                                <View style={[styles.storyStickerThumb, styles.storyStickerThumbFallback]}>
                                    <Icon name="images-outline" size={22} color="#9CA3AF" />
                                </View>
                            )}
                            <View style={styles.storyStickerMeta}>
                                <Text style={styles.storyStickerLabel}>{label}</Text>
                                {bodyText ? (
                                    <Text style={styles.storyStickerBody} numberOfLines={3}>
                                        {bodyText}
                                    </Text>
                                ) : null}
                                {item.storyId ? (
                                    <Text style={styles.storyStickerHint}>Tap to view story</Text>
                                ) : null}
                            </View>
                        </View>
                    </TouchableOpacity>
                    {renderReactionPills()}
                </View>
            </>
        );
    } else {
        const sharedRef = getMessageSharedRef(item);
        if (sharedRef) {
            const sharedCard = sharedPost ? (
                <DmSharedPostCard post={sharedPost} onTap={ctx.openScenesForPost} />
            ) : (
                <DmSharedPostPreviewCard
                    postId={sharedRef.postId}
                    token={sharedRef.token}
                    userId={userId}
                    onTap={() => ctx.openScenesForRef(sharedRef)}
                />
            );
            inner = (
                <>
                    {!isFromMe ? (
                        <TouchableOpacity
                            onPress={() => {
                                if (item.senderHandle) {
                                    navigation.navigate('ViewProfile', {
                                        handle: item.senderHandle,
                                    });
                                }
                            }}
                        >
                            <Avatar
                                src={senderAvatar}
                                name={item.senderHandle?.split('@')[0] || 'User'}
                                size={ox(28)}
                            />
                        </TouchableOpacity>
                    ) : null}
                    <View
                        style={[
                            styles.messageColumn,
                            isFromMe ? styles.messageColumnMe : styles.messageColumnOther,
                            styles.sharedPostColumn,
                        ]}
                    >
                        {replyPreview ? <DmQuotedReply preview={replyPreview} /> : null}
                        <DmMessagePressable onLongPress={() => ctx.openMessageActions(item)} onDoubleTap={onDoubleTap} suppressTapRef={suppressTapRef}>
                            {sharedCard}
                        </DmMessagePressable>
                        {item.text?.trim() && !/^https?:\/\/\S+$/.test(item.text.trim()) ? (
                            <Text
                                style={[
                                    styles.messageText,
                                    styles.sharedPostCaption,
                                    isFromMe ? styles.messageTextFromMe : styles.messageTextFromOther,
                                ]}
                            >
                                {item.text.trim()}
                            </Text>
                        ) : null}
                        {renderReactionPills()}
                        <View
                            style={[
                                styles.messageMetaRow,
                                isFromMe ? styles.messageMetaRowMe : styles.messageMetaRowOther,
                            ]}
                        >
                            <Text style={styles.messageTimeOutside}>
                                {ctx.formatMessageClock(item.timestamp)}
                            </Text>
                        </View>
                    </View>
                </>
            );
        } else {
            const sentBubbleColor = dmSentBubbleColor(dmSentStyle);
            const sentGradient = dmSentBubbleGradient(dmSentStyle);
            const isMediaOnlyMessage = Boolean(
                item.imageUrl && !item.text?.trim() && !item.audioUrl && !(item as any).replyTo
            );
            const bubbleFill = isFromMe ? sentBubbleColor : 'rgba(255,255,255,0.08)';

            const bubbleContent = (
                <>
                    {replyPreview ? <DmQuotedReply preview={replyPreview} /> : null}
                    {item.text ? (
                        <Text
                            style={[
                                styles.messageText,
                                isMediaOnlyMessage ? styles.messageTextPlain : null,
                                isFromMe ? styles.messageTextFromMe : styles.messageTextFromOther,
                            ]}
                        >
                            {translatedText || item.text}
                        </Text>
                    ) : null}
                    {!!translatedText && !!item.text ? (
                        <Text style={styles.translatedOriginalText}>Original: {item.text}</Text>
                    ) : null}
                    {item.imageUrl ? (
                        ctx.isLikelyVideoUrl(item.imageUrl) ? (
                            <DmInlineVideoMessage
                                uri={item.imageUrl}
                                posterUrl={sharedPost?.videoPosterUrl ?? sharedPost?.thumbnailUrl}
                                posterCandidates={[
                                    sharedPost?.mediaItems?.[0]?.posterUrl,
                                    sharedPost?.mediaItems?.[0]?.thumbnailUrl,
                                ]}
                                width={DM_MEDIA_MAX_WIDTH}
                                isActive={isActive}
                            />
                        ) : (
                            <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
                        )
                    ) : null}
                    {item.audioUrl ? (
                        <TouchableOpacity
                            style={styles.audioMessagePill}
                            onPress={() => {
                                if (suppressTapRef.current) return;
                                void ctx.handlePlayAudioMessage(item.audioUrl);
                            }}
                        >
                            <Icon
                                name={isPlayingAudio ? 'pause' : 'play'}
                                size={ox(16)}
                                color="#FFFFFF"
                            />
                            <Text style={styles.audioMessageText}>
                                {isPlayingAudio ? 'Playing...' : 'Voice message'}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                    {renderReactionPills()}
                </>
            );

            const messageMeta = (
                <View style={[styles.messageMetaRow, isFromMe ? styles.messageMetaRowMe : styles.messageMetaRowOther]}>
                    <Text style={styles.messageTimeOutside}>{ctx.formatMessageClock(item.timestamp)}</Text>
                    {isFromMe && !isGroupThread ? (
                        <Icon
                            name="checkmark-done"
                            size={ox(13)}
                            color={(item as any).read ? dmSentBubbleColor(dmSentStyle) : '#8E8E93'}
                        />
                    ) : null}
                </View>
            );

            const bubbleShell = (
                <IMessageDmBubbleShell
                    isFromMe={isFromMe}
                    tailBackgroundColor={bubbleFill}
                    showTail={false}
                    gradientColors={isFromMe && !isMediaOnlyMessage ? [...sentGradient] : undefined}
                    bubbleStyle={
                        isMediaOnlyMessage
                            ? {
                                  backgroundColor: 'transparent',
                                  paddingHorizontal: 0,
                                  paddingVertical: 0,
                                  shadowOpacity: 0,
                                  elevation: 0,
                                  borderBottomLeftRadius: 18,
                                  borderBottomRightRadius: 18,
                              }
                            : [
                                  !isFromMe
                                      ? {
                                            borderWidth: 1,
                                            borderColor: 'rgba(255,255,255,0.12)',
                                        }
                                      : null,
                                  reactions?.length ? { paddingBottom: ox(22) } : null,
                              ]
                    }
                >
                    {bubbleContent}
                </IMessageDmBubbleShell>
            );

            inner = (
                <>
                    {!isFromMe ? (
                        <Avatar src={senderAvatar} name={item.senderHandle.split('@')[0]} size={ox(32)} />
                    ) : null}
                    {!isFromMe && isSwiping ? (
                        <Animated.View
                            style={[
                                styles.swipeReplyCue,
                                {
                                    opacity: swipeAnim.interpolate({
                                        inputRange: [0, 24, 48],
                                        outputRange: [0, 0.55, 1],
                                        extrapolate: 'clamp',
                                    }),
                                    transform: [
                                        {
                                            scale: swipeAnim.interpolate({
                                                inputRange: [0, 48, 84],
                                                outputRange: [0.55, 1, 1.08],
                                                extrapolate: 'clamp',
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        >
                            <Icon name="arrow-undo" size={ox(14)} color="#E5E7EB" />
                        </Animated.View>
                    ) : null}
                    <View style={[styles.messageColumn, isFromMe ? styles.messageColumnMe : styles.messageColumnOther]}>
                        <Animated.View
                            {...(!isFromMe ? bubblePanResponder.panHandlers : {})}
                            style={!isFromMe && isSwiping ? { transform: [{ translateX: swipeAnim }] } : undefined}
                        >
                            <DmMessagePressable onLongPress={() => ctx.openMessageActions(item)} onDoubleTap={onDoubleTap} suppressTapRef={suppressTapRef}>
                                {bubbleShell}
                            </DmMessagePressable>
                        </Animated.View>
                        {messageMeta}
                    </View>
                </>
            );
        }
    }

    return (
        <Animated.View
            style={[
                styles.messageContainer,
                isFromMe ? styles.messageFromMe : styles.messageFromOther,
                entryStyle,
            ]}
        >
            {inner}
        </Animated.View>
    );
});


type VoiceDraftSegment = { audioUrl: string; durationSeconds: number };
type VoiceDraftState = {
    audioUrl: string;
    durationSeconds: number;
    segments: VoiceDraftSegment[];
    canContinue?: boolean;
};

const DEBUG_MESSAGE_PAGING =
    __DEV__ && (globalThis as { __CLIPS_DEBUG_MESSAGE_PAGING__?: boolean }).__CLIPS_DEBUG_MESSAGE_PAGING__ === true;

/** Voice notes / gold mic — off for now (text + images only). */
const ENABLE_VOICE_NOTES = false;

type SheetAlertState = {
    title: string;
    message?: string;
    icon?: 'success' | 'alert' | 'info';
    confirmButtonText?: string;
    showCancelButton?: boolean;
    cancelButtonText?: string;
    onConfirm?: () => void;
};

type SheetMenuState = {
    title: string;
    subtitle?: string;
    options: GazetteerMenuOption[];
};

export default function MessagesScreen({ route, navigation }: any) {
    const {
        handle,
        chatGroupId,
        groupName: routeGroupName,
        communityCreated,
        communityCreatedName,
    } = route.params || {};
    const isGroupThread = Boolean(chatGroupId);
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const initialGroupName =
        (typeof routeGroupName === 'string' && routeGroupName.trim()) ||
        (typeof communityCreatedName === 'string' && communityCreatedName.trim()) ||
        'Group';
    const [groupName, setGroupName] = useState(initialGroupName);
    const [groupAvatarUrl, setGroupAvatarUrl] = useState<string | undefined>(undefined);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const visibleMessages = useMemo(() => dedupeChatMessages(messages), [messages]);
    // Parent lookup for enriching thin reply payloads (id-only) into full quote cards.
    const messagesById = useMemo(() => {
        const map = new Map<string, ChatMessage>();
        for (const m of visibleMessages) map.set(m.id, m);
        return map;
    }, [visibleMessages]);
    const [messageText, setMessageText] = useState('');
    const [loading, setLoading] = useState(true);
    const [threadCursor, setThreadCursor] = useState<string | null>(null);
    const [threadHasMore, setThreadHasMore] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const composerInputRef = useRef<TextInput>(null);
    const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupAvatarDataUrl, setNewGroupAvatarDataUrl] = useState<string | undefined>(undefined);
    const [creatingGroup, setCreatingGroup] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [isGroupAdmin, setIsGroupAdmin] = useState(false);
    const [inviteHandle, setInviteHandle] = useState('');
    const [inviteBusy, setInviteBusy] = useState(false);
    const [inviteSuggestions, setInviteSuggestions] = useState<Array<{ handle: string; displayName?: string; avatarUrl?: string }>>([]);
    const [inviteSearching, setInviteSearching] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [imageCompose, setImageCompose] = useState<{ imageUrl: string; caption: string } | null>(null);
    const [messageReactions, setMessageReactions] = useState<Record<string, Array<{ emoji: string; users: string[] }>>>({});
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [stickerTargetMessageId, setStickerTargetMessageId] = useState<string | null>(null);
    const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
    const [isRecordingVoice, setIsRecordingVoice] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [recordingGestureHint, setRecordingGestureHint] = useState<'none' | 'cancel'>('none');
    const [voiceDraft, setVoiceDraft] = useState<VoiceDraftState | null>(null);
    const [isPlayingVoiceDraft, setIsPlayingVoiceDraft] = useState(false);
    const [voiceDraftPlaySeconds, setVoiceDraftPlaySeconds] = useState(0);
    const [voiceDraftTrackWidth, setVoiceDraftTrackWidth] = useState(0);
    const voiceDraftPlayingRef = useRef(false);
    const voiceDraftSegmentIndexRef = useRef(0);
    const voiceDraftSegmentOffsetsRef = useRef<number[]>([0]);
    const voiceSegmentsRef = useRef<VoiceDraftSegment[]>([]);
    const recordingPathRef = useRef<string | null>(null);
    const recorderSessionActiveRef = useRef(false);
    const isRecordingVoiceRef = useRef(false);
    const recordingGestureHintRef = useRef<'none' | 'cancel'>('none');
    const micGestureStartRef = useRef({ x: 0, y: 0, at: 0, wasRecording: false });
    const voiceDraftRef = useRef<typeof voiceDraft>(null);
    const [dmSentStyle, setDmSentStyle] = useState<DmSentBubbleStyle>('blue');
    const [sharedPosts, setSharedPosts] = useState<Record<string, Post>>({});
    const [isFollowing, setIsFollowing] = useState(false);
    const [followRequestPending, setFollowRequestPending] = useState(false);
    const [showFollowCheck, setShowFollowCheck] = useState(false);
    const [isFollowLoading, setIsFollowLoading] = useState(false);
    const [otherUserPlacesTraveled, setOtherUserPlacesTraveled] = useState<string[] | undefined>(
        undefined,
    );

    useEffect(() => {
        void getDmSentBubblePreference().then(setDmSentStyle);
    }, []);
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const [sheetAlert, setSheetAlert] = useState<SheetAlertState | null>(null);
    const [sheetMenu, setSheetMenu] = useState<SheetMenuState | null>(null);
    const [messageActionsTarget, setMessageActionsTarget] = useState<ChatMessage | null>(null);
    const [reactionFly, setReactionFly] = useState<{
        messageId: string;
        emoji: string;
        target: ReactionFlyTarget | null;
    } | null>(null);
    const reactionPillRefs = useRef<Record<string, View | null>>({});
    const rowHandlersRef = useRef<DmRowHandlers>(null as unknown as DmRowHandlers);
    const swipeAnim = useRef(new Animated.Value(0)).current;
    const replyBarAnim = useRef(new Animated.Value(0)).current;
    const swipeMessageIdRef = useRef<string | null>(null);
    const [showChatInfo, setShowChatInfo] = useState(false);
    const [leaveGroupBusy, setLeaveGroupBusy] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const shouldAutoScrollRef = useRef(true);
    /** True from thread open until the initial bottom anchor has settled. While
     * pending, maintainVisibleContentPosition stays OFF (it would anchor the old
     * position against scrollToEnd) and late-measuring rows re-trigger the scroll. */
    const initialScrollPendingRef = useRef(true);
    const [mvcpEnabled, setMvcpEnabled] = useState(false);
    const initialScrollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const isScreenFocused = useIsFocused();
    // Message ids currently inside the active viewport — drives inline video auto-pause.
    const [activeMessageIds, setActiveMessageIds] = useState<Set<string>>(() => new Set());
    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 55,
        minimumViewTime: 120,
    }).current;
    const onViewableItemsChanged = useRef(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            const next = new Set<string>();
            for (const entry of viewableItems) {
                const id = (entry.item as ChatMessage | undefined)?.id;
                if (entry.isViewable && id) next.add(id);
            }
            setActiveMessageIds((prev) => {
                if (prev.size === next.size) {
                    let same = true;
                    for (const id of next) {
                        if (!prev.has(id)) {
                            same = false;
                            break;
                        }
                    }
                    if (same) return prev;
                }
                return next;
            });
        },
    ).current;
    const [swipingMessageId, setSwipingMessageId] = useState<string | null>(null);
    const audioRecorderRef = useRef(AudioRecorderPlayer);
    const communityCreatedHandledRef = useRef(false);

    useEffect(() => {
        isRecordingVoiceRef.current = isRecordingVoice;
    }, [isRecordingVoice]);

    useEffect(() => {
        recordingGestureHintRef.current = recordingGestureHint;
    }, [recordingGestureHint]);

    useEffect(() => {
        voiceDraftRef.current = voiceDraft;
    }, [voiceDraft]);

    const showAlert = useCallback((opts: SheetAlertState) => {
        setSheetAlert(opts);
    }, []);

    const showMenu = useCallback((opts: SheetMenuState) => {
        setSheetMenu(opts);
    }, []);

    // --- Consolidated hooks (relocated from the handler section below) ---
    // Every hook in this component lives in this top block or in the initial
    // state/ref declarations above it. Nothing below this point calls a hook
    // except the two voice-mic refs, which are unconditional top-level calls
    // placed next to the handlers they capture.

    /** Measure the reaction pill so the fly overlay can land on it. */
    const measureReactionFlyTarget = useCallback(() => {
        if (!reactionFly) return;
        const key = `${reactionFly.messageId}::${reactionFly.emoji}`;
        const node = reactionPillRefs.current[key];
        if (!node || typeof (node as any).measureInWindow !== 'function') {
            // Pill may not have laid out yet — retry once next frame
            requestAnimationFrame(() => {
                const retry = reactionPillRefs.current[key];
                if (retry && typeof (retry as any).measureInWindow === 'function') {
                    (retry as View).measureInWindow((x, y, w, h) => {
                        setReactionFly((prev) =>
                            prev && prev.messageId === reactionFly.messageId && prev.emoji === reactionFly.emoji
                                ? { ...prev, target: { x: x + w / 2, y: y + h / 2 } }
                                : prev,
                        );
                    });
                } else {
                    setReactionFly(null);
                }
            });
            return;
        }
        (node as View).measureInWindow((x, y, w, h) => {
            setReactionFly((prev) =>
                prev && prev.messageId === reactionFly.messageId && prev.emoji === reactionFly.emoji
                    ? { ...prev, target: { x: x + w / 2, y: y + h / 2 } }
                    : prev,
            );
        });
    }, [reactionFly]);

    useEffect(() => {
        if (!replyingTo && !editingMessage) {
            replyBarAnim.setValue(0);
            return;
        }
        replyBarAnim.setValue(0);
        Animated.spring(replyBarAnim, {
            toValue: 1,
            friction: 8,
            tension: 120,
            useNativeDriver: true,
        }).start();
    }, [replyingTo?.id, editingMessage?.id, replyBarAnim]);

    // Reply selection (long-press or swipe) focuses the composer so the quote
    // strip anchored above the input is immediately actionable.
    useEffect(() => {
        if (!replyingTo) return;
        const t = setTimeout(() => composerInputRef.current?.focus(), 60);
        return () => clearTimeout(t);
    }, [replyingTo?.id]);

    // Voice recorder/player teardown on unmount.
    useEffect(() => {
        return () => {
            voiceDraftPlayingRef.current = false;
            void audioRecorderRef.current.stopRecorder().catch(() => {});
            audioRecorderRef.current.removeRecordBackListener();
            void audioRecorderRef.current.stopPlayer().catch(() => {});
            audioRecorderRef.current.removePlayBackListener();
            recorderSessionActiveRef.current = false;
        };
    }, []);

    /**
     * Voice-mic gesture surface. The actions ref starts as no-ops and is
     * re-pointed at the real handlers on every render (assignment below, next
     * to their definitions), so this hook can live in the top block without a
     * TDZ reference to handler consts declared later.
     */
    const voiceMicActionsRef = useRef<{
        startVoiceRecording: (appendSegment?: boolean) => Promise<unknown>;
        pauseVoiceRecordingForPreview: () => Promise<unknown>;
        cancelVoiceRecording: () => Promise<unknown>;
    }>({
        startVoiceRecording: async () => false,
        pauseVoiceRecordingForPreview: async () => undefined,
        cancelVoiceRecording: async () => undefined,
    });

    const voiceMicPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !voiceDraftRef.current,
            onMoveShouldSetPanResponder: () => isRecordingVoiceRef.current,
            onPanResponderGrant: (evt) => {
                if (voiceDraftRef.current) return;
                const wasRecording = isRecordingVoiceRef.current;
                micGestureStartRef.current = {
                    x: evt.nativeEvent.pageX,
                    y: evt.nativeEvent.pageY,
                    at: Date.now(),
                    wasRecording,
                };
                setRecordingGestureHint('none');
                if (!wasRecording) {
                    void voiceMicActionsRef.current.startVoiceRecording();
                }
            },
            onPanResponderMove: (evt) => {
                if (!isRecordingVoiceRef.current) return;
                const dx = evt.nativeEvent.pageX - micGestureStartRef.current.x;
                if (dx < -72) {
                    setRecordingGestureHint('cancel');
                } else {
                    setRecordingGestureHint('none');
                }
            },
            onPanResponderRelease: () => {
                const { at, wasRecording } = micGestureStartRef.current;
                const heldMs = Date.now() - at;
                const hint = recordingGestureHintRef.current;
                if (hint === 'cancel') {
                    void voiceMicActionsRef.current.cancelVoiceRecording();
                    setRecordingGestureHint('none');
                    return;
                }
                if (!isRecordingVoiceRef.current) {
                    setRecordingGestureHint('none');
                    return;
                }
                if (heldMs >= 400) {
                    void voiceMicActionsRef.current.pauseVoiceRecordingForPreview();
                } else if (wasRecording) {
                    void voiceMicActionsRef.current.pauseVoiceRecordingForPreview();
                }
                setRecordingGestureHint('none');
            },
            onPanResponderTerminate: () => {
                if (isRecordingVoiceRef.current && micGestureStartRef.current.wasRecording) {
                    void voiceMicActionsRef.current.pauseVoiceRecordingForPreview();
                }
                setRecordingGestureHint('none');
            },
        }),
    ).current;

    useEffect(() => {
        if (!communityCreated || communityCreatedHandledRef.current) return;
        communityCreatedHandledRef.current = true;
        const name =
            (typeof communityCreatedName === 'string' && communityCreatedName.trim()) ||
            groupName ||
            'your community';
        showAlert({
            title: 'Community created',
            message: `You are in "${name}". Use + in the header to invite members.`,
            icon: 'success',
            confirmButtonText: 'Open chat',
        });
        navigation.setParams({
            communityCreated: undefined,
            communityCreatedName: undefined,
        });
    }, [communityCreated, communityCreatedName, groupName, navigation, showAlert]);

    const scrollMessagesToBottom = useCallback((animated = true) => {
        requestAnimationFrame(() => {
            flatListRef.current?.scrollToEnd({ animated });
        });
    }, []);

    const composerPlaceholder = editingMessage ? 'Edit message…' : 'Message…';

    const handleLeaveGroup = async () => {
        if (!chatGroupId || leaveGroupBusy) return;
        setLeaveGroupBusy(true);
        try {
            await leaveChatGroup(chatGroupId);
            setShowChatInfo(false);
            showAlert({
                title: 'Left group',
                message: `You left "${groupName}".`,
                icon: 'success',
                confirmButtonText: 'OK',
                onConfirm: () => {
                    if (navigation.canGoBack()) {
                        navigation.goBack();
                    } else {
                        navigateMainTab(navigation, 'Inbox');
                    }
                },
            });
        } catch (error) {
            console.error('Error leaving group:', error);
            showAlert({
                title: 'Failed to leave group',
                message: 'Could not leave this group right now.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
        } finally {
            setLeaveGroupBusy(false);
        }
    };

    const confirmLeaveGroup = () => {
        showAlert({
            title: `Leave "${groupName}"?`,
            message: 'You can be invited again later.',
            icon: 'info',
            confirmButtonText: 'Leave group',
            cancelButtonText: 'Cancel',
            showCancelButton: true,
            onConfirm: () => {
                void handleLeaveGroup();
            },
        });
    };

    const isLikelyVideoUrl = (url?: string) => {
        if (!url) return false;
        const trimmed = url.trim();
        return /^data:video\//i.test(trimmed) || /\.(mp4|webm|m4v|mov)(\?|#|$)/i.test(trimmed);
    };

    useEffect(() => {
        if (!isGroupThread) {
            setGroupAvatarUrl(undefined);
        }
        // Flush the previous thread completely on open/switch: stale rows (and the
        // FlatList's retained native offset) must never leak into the new thread.
        setMessages([]);
        setReplyingTo(null);
        setEditingMessage(null);
        setThreadCursor(null);
        setThreadHasMore(false);
        initialScrollPendingRef.current = true;
        setMvcpEnabled(false);
        shouldAutoScrollRef.current = true;
        loadMessages(true);
    }, [handle, chatGroupId]);

    // Real-time DM delivery: register this user on the Socket.IO relay and
    // upsert incoming messages for THIS thread in place. The relay emits the
    // same payload on both `newMessage` and `conversationUpdated`; we listen
    // to one socket event plus the local bus, and merge by id / sender+body+time
    // so optimistic sends and echoes never render twice.
    useEffect(() => {
        if (!user?.handle) return;
        const socket = connectSocket(user.handle);
        if (isGroupThread && chatGroupId) {
            joinGroupChat(String(chatGroupId));
        }

        const onRealtime = (data: any) => {
            const rawMsg = data?.message ?? (data?.id ? data : null);
            if (!rawMsg || typeof rawMsg !== 'object') return; // metadata-only update (pin/mute/…)

            if (isGroupThread) {
                const gid = data?.chat_group_id ?? data?.chatGroupId ?? rawMsg.chatGroupId;
                if (!gid || String(gid) !== String(chatGroupId)) return;
            } else {
                const participants: string[] =
                    data?.participants ||
                    (rawMsg.senderHandle ? [rawMsg.senderHandle, user.handle] : []);
                if (!participants.includes(user.handle)) return;
                if (handle && rawMsg.senderHandle !== user.handle && !participants.includes(handle)) return;
                if (handle && rawMsg.senderHandle !== user.handle && rawMsg.senderHandle !== handle) return;
            }

            const incomingId = String(rawMsg.id ?? '').trim();
            const incoming: ChatMessage = {
                id: incomingId && incomingId !== 'undefined' ? incomingId : `echo-${Date.now()}`,
                senderHandle: String(rawMsg.senderHandle ?? rawMsg.sender_handle ?? ''),
                text: rawMsg.text ?? undefined,
                imageUrl: rawMsg.imageUrl ?? rawMsg.image_url ?? undefined,
                audioUrl: rawMsg.audioUrl ?? rawMsg.audio_url ?? undefined,
                timestamp:
                    typeof rawMsg.timestamp === 'number'
                        ? rawMsg.timestamp
                        : rawMsg.created_at
                          ? new Date(rawMsg.created_at).getTime()
                          : Date.now(),
                replyTo: rawMsg.replyTo ?? rawMsg.reply_to ?? undefined,
                sourcePostId: rawMsg.sourcePostId ?? rawMsg.source_post_id ?? undefined,
            };
            if (!incoming.senderHandle) return;

            setMessages((prev) => upsertChatMessage(prev, incoming));
            if (incoming.senderHandle !== user.handle) {
                shouldAutoScrollRef.current = true;
            }
        };

        socket?.on('newMessage', onRealtime);
        // Same-device fallback bus (socket disabled / mock mode).
        const busSub = DeviceEventEmitter.addListener('conversationUpdated', onRealtime);

        return () => {
            socket?.off('newMessage', onRealtime);
            busSub.remove();
            if (isGroupThread && chatGroupId) {
                leaveGroupChat(String(chatGroupId));
            }
        };
    }, [user?.handle, handle, chatGroupId, isGroupThread]);

    useEffect(() => {
        if (!isGroupThread || !chatGroupId) {
            setIsGroupAdmin(false);
            return;
        }
        let cancelled = false;
        void fetchMyChatGroups(user?.handle)
            .then((groups) => {
                if (cancelled) return;
                const current = (groups || []).find((g) => String(g.id) === String(chatGroupId));
                const admin = isChatGroupAdmin(current, user?.id);
                setIsGroupAdmin(admin);
                if (current?.name?.trim()) setGroupName(current.name.trim());
                if (current?.avatar_url) setGroupAvatarUrl(current.avatar_url);
            })
            .catch(() => {
                if (!cancelled) setIsGroupAdmin(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isGroupThread, chatGroupId, user?.handle, user?.id]);

    useEffect(() => {
        if (!inviteOpen) return;
        const q = inviteHandle.trim().replace(/^@/, '');
        if (q.length < 2) {
            setInviteSuggestions([]);
            setInviteSearching(false);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            setInviteSearching(true);
            try {
                const result = await unifiedSearch({ q, types: 'users', usersLimit: 6 });
                const items = ((result as any)?.sections?.users?.items || []) as any[];
                if (!cancelled) {
                    setInviteSuggestions(
                        items
                            .map((u) => ({
                                handle: String(u?.handle || '').trim(),
                                displayName: String(u?.display_name || u?.displayName || '').trim() || undefined,
                                avatarUrl: (u?.avatar_url || u?.avatarUrl) as string | undefined,
                            }))
                            .filter((u) => !!u.handle)
                            .slice(0, 6),
                    );
                }
            } catch {
                if (!cancelled) setInviteSuggestions([]);
            } finally {
                if (!cancelled) setInviteSearching(false);
            }
        }, 220);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [inviteHandle, inviteOpen]);

    useEffect(() => {
        if (messages.length > 0 && user?.handle) {
            if (isGroupThread && chatGroupId) {
                markGroupConversationReadById(chatGroupId, user.handle).catch(console.error);
            } else if (handle) {
                markConversationRead(user.handle, handle).catch(console.error);
            }
        }
    }, [messages, handle, chatGroupId, isGroupThread, user?.handle]);

    useEffect(() => {
        let cancelled = false;
        async function syncMuted() {
            if (!user?.handle || !handle || isGroupThread) {
                if (!cancelled) setIsMuted(false);
                return;
            }
            try {
                const muted = await isConversationMuted(user.handle, handle);
                if (!cancelled) setIsMuted(!!muted);
            } catch {
                if (!cancelled) setIsMuted(false);
            }
        }
        async function syncBlocked() {
            if (!user?.handle || !handle || isGroupThread) {
                if (!cancelled) setIsBlocked(false);
                return;
            }
            try {
                const blocked = await isUserBlocked(user.handle, handle);
                if (!cancelled) setIsBlocked(!!blocked);
            } catch {
                if (!cancelled) setIsBlocked(false);
            }
        }
        syncMuted();
        syncBlocked();
        return () => {
            cancelled = true;
        };
    }, [user?.handle, handle, isGroupThread]);

    useEffect(() => {
        let cancelled = false;
        async function loadOtherUserPlaces() {
            if (!handle || isGroupThread) {
                if (!cancelled) setOtherUserPlacesTraveled(undefined);
                return;
            }
            try {
                let places: string[] = [];
                if (user?.id) {
                    try {
                        const profile = await fetchUserProfile(handle, user.id);
                        const apiPlaces =
                            (profile as any).places_traveled || (profile as any).placesTraveled;
                        if (Array.isArray(apiPlaces) && apiPlaces.length > 0) {
                            places = apiPlaces;
                        } else if (typeof (profile as any).bio === 'string') {
                            places = parsePlacesFromBio((profile as any).bio);
                        }
                    } catch {
                        // fall through to mock fallback
                    }
                }
                if ((!places || places.length === 0) && handle === 'Bob@Ireland') {
                    places = ['Cork', 'Galway', 'Belfast', 'London', 'Paris'];
                }
                if (!cancelled) {
                    setOtherUserPlacesTraveled(places && places.length > 0 ? places : []);
                }
            } catch {
                if (!cancelled) setOtherUserPlacesTraveled([]);
            }
        }
        void loadOtherUserPlaces();
        return () => {
            cancelled = true;
        };
    }, [handle, isGroupThread, user?.id]);

    useEffect(() => {
        let cancelled = false;
        async function checkFollow() {
            if (!handle || !user?.id || isGroupThread || handle === user.handle) {
                if (!cancelled) {
                    setIsFollowing(false);
                    setShowFollowCheck(false);
                }
                return;
            }
            try {
                const followedUsers = await getFollowedUsers(user.id);
                const following = followedUsers.includes(handle);
                const pending =
                    !following &&
                    Boolean(user.handle && hasPendingFollowRequest(user.handle, handle));
                if (!cancelled) {
                    setIsFollowing(following);
                    setFollowRequestPending(pending);
                    setShowFollowCheck(following);
                }
            } catch {
                if (!cancelled) {
                    setIsFollowing(false);
                    setFollowRequestPending(false);
                    setShowFollowCheck(false);
                }
            }
        }
        void checkFollow();
        return () => {
            cancelled = true;
        };
    }, [handle, isGroupThread, user?.handle, user?.id]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (user?.handle && handle && handle !== user.handle && isFollowing) {
            setShowFollowCheck(true);
            timer = setTimeout(() => setShowFollowCheck(false), 2500);
        } else {
            setShowFollowCheck(false);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [isFollowing, handle, user?.handle]);

    useEffect(() => {
        let cancelled = false;
        const refs = new Map<string, SharedPostRef>();
        for (const msg of messages) {
            const ref = getMessageSharedRef(msg);
            if (ref) refs.set(sharedPostRefKey(ref), ref);
            // Quoted parents may sit outside this page; their quote text (a
            // share URL for post parents) still lets us resolve the poster.
            if (msg.replyTo?.text) {
                const quoteRef = extractSharedPostRef(msg.replyTo.text);
                if (quoteRef) refs.set(sharedPostRefKey(quoteRef), quoteRef);
            }
        }
        const missing = Array.from(refs.entries()).filter(([key]) => !sharedPosts[key]);
        if (missing.length === 0) return;
        void Promise.all(
            missing.map(async ([key, ref]) => {
                try {
                    const post = await loadSharedPost({
                        token: ref.token,
                        postId: ref.postId,
                        userId: user?.id,
                    });
                    if (!cancelled && post) {
                        setSharedPosts((prev) =>
                            prev[key] ? prev : { ...prev, [key]: post },
                        );
                    }
                } catch {
                    // ignore missing posts
                }
            }),
        );
        return () => {
            cancelled = true;
        };
        // sharedPosts intentionally omitted — we only fetch missing refs from messages
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, user?.id]);

    const openScenesForPost = (post: Post) => {
        setScenesLaunchPayload({
            initialPostId: post.id,
            posts: [post],
            feedLabel: 'Messages',
        });
        navigation.navigate('Scenes', {
            initialPostId: post.id,
            feedLabel: 'Messages',
        });
    };

    const openScenesForRef = (ref: SharedPostRef) => {
        const key = sharedPostRefKey(ref);
        loadSharedPost({ token: ref.token, postId: ref.postId, userId: user?.id })
            .then((post) => {
                if (post) {
                    setSharedPosts((prev) => ({ ...prev, [key]: post }));
                    openScenesForPost(post);
                } else {
                    showAlert({
                        title: 'Could not load post',
                        icon: 'alert',
                        confirmButtonText: 'OK',
                    });
                }
            })
            .catch(() => {
                showAlert({
                    title: 'Could not load post',
                    icon: 'alert',
                    confirmButtonText: 'OK',
                });
            });
    };

    const openPlacesTraveled = () => {
        if (!handle) return;
        if (!otherUserPlacesTraveled || otherUserPlacesTraveled.length === 0) {
            showAlert({
                title: 'No Places Traveled',
                message: `${handle} hasn't added any places they've traveled to their profile yet.`,
                icon: 'alert',
                confirmButtonText: 'OK',
            });
            return;
        }
        showAlert({
            title: 'Places Traveled',
            message: otherUserPlacesTraveled.join('\n'),
            icon: 'info',
            confirmButtonText: 'OK',
        });
    };

    const handleFollowFromHeader = async () => {
        if (!user?.id || !user?.handle || !handle || isFollowLoading || handle === user.handle) return;
        setIsFollowLoading(true);
        try {
            const s = getState(user.id);
            const wasFollowing = getFollowState(s.follows, handle);
            const wasRequested = hasPendingFollowRequest(user.handle, handle);
            // Following → unfollow; Requested → cancel; else → follow/request.
            const nextFollowing = wasFollowing ? false : wasRequested ? false : true;
            const result = await followOrRequest({
                userId: user.id,
                targetHandle: handle,
                viewerHandle: user.handle,
                nextFollowing,
            });
            setIsFollowing(result.following);
            setFollowRequestPending(result.requested);
            if (result.requested && !wasRequested) {
                showAlert({
                    title: 'Follow Request Sent',
                    message: `Your follow request was sent to ${handle}. You'll be notified when they respond.`,
                    icon: 'success',
                    confirmButtonText: 'OK',
                });
            }
        } catch {
            const current = getFollowState(getState(user.id).follows, handle);
            setIsFollowing(current);
            setFollowRequestPending(
                Boolean(user.handle && handle && hasPendingFollowRequest(user.handle, handle)),
            );
            showAlert({
                title: 'Action failed',
                message: 'Could not update follow status right now.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
        } finally {
            setIsFollowLoading(false);
        }
    };

    const confirmBlockUser = () => {
        if (!user?.handle || !handle || isGroupThread) return;
        if (isBlocked) {
            void (async () => {
                try {
                    await unblockUser(user.handle, handle);
                    setIsBlocked(false);
                    setShowChatInfo(false);
                } catch {
                    showAlert({
                        title: 'Action failed',
                        message: 'Could not unblock this user right now.',
                        icon: 'alert',
                        confirmButtonText: 'OK',
                    });
                }
            })();
            return;
        }
        showAlert({
            title: `Block ${handle}?`,
            message: "You won't receive messages from them.",
            icon: 'alert',
            confirmButtonText: 'Block',
            showCancelButton: true,
            cancelButtonText: 'Cancel',
            onConfirm: () => {
                void (async () => {
                    try {
                        await blockUser(user.handle, handle);
                        setIsBlocked(true);
                        setShowChatInfo(false);
                        navigation.goBack();
                    } catch {
                        showAlert({
                            title: 'Action failed',
                            message: 'Could not block this user right now.',
                            icon: 'alert',
                            confirmButtonText: 'OK',
                        });
                    }
                })();
            },
        });
    };

    const confirmDeleteConversation = () => {
        if (!user?.handle || !handle || isGroupThread) return;
        showAlert({
            title: `Delete conversation with ${handle}?`,
            message: 'This cannot be undone.',
            icon: 'alert',
            confirmButtonText: 'Delete',
            showCancelButton: true,
            cancelButtonText: 'Cancel',
            onConfirm: () => {
                void (async () => {
                    try {
                        await deleteConversation(user.handle, handle);
                        setShowChatInfo(false);
                        navigation.goBack();
                    } catch {
                        showAlert({
                            title: 'Action failed',
                            message: 'Could not delete this conversation right now.',
                            icon: 'alert',
                            confirmButtonText: 'OK',
                        });
                    }
                })();
            },
        });
    };

    /**
     * The single initial-scroll authority. After the first page loads, anchor to
     * the bottom repeatedly while async rows (images, shared-post cards) finish
     * measuring, then hand control back: clear the pending flag and enable
     * maintainVisibleContentPosition for older-message prepends.
     */
    useEffect(() => {
        if (loading || messages.length === 0 || !initialScrollPendingRef.current) return;
        for (const t of initialScrollTimersRef.current) clearTimeout(t);
        const delays = [0, 120, 350, 700];
        initialScrollTimersRef.current = delays.map((delay, i) =>
            setTimeout(() => {
                scrollMessagesToBottom(false);
                if (i === delays.length - 1) {
                    initialScrollPendingRef.current = false;
                    setMvcpEnabled(true);
                }
            }, delay),
        );
        return () => {
            for (const t of initialScrollTimersRef.current) clearTimeout(t);
            initialScrollTimersRef.current = [];
        };
    }, [loading, messages.length, scrollMessagesToBottom]);

    // Shared-post cards arrive (and grow) after the message rows: while the
    // initial anchor is still pending, each resolution re-asserts the bottom.
    useEffect(() => {
        if (!initialScrollPendingRef.current || messages.length === 0) return;
        scrollMessagesToBottom(false);
    }, [sharedPosts, messages.length, scrollMessagesToBottom]);

    const loadMessages = async (reset: boolean = false) => {
        if (!user?.handle) return;
        if (reset) {
            setThreadCursor(null);
            setThreadHasMore(false);
            shouldAutoScrollRef.current = true;
            setLoading(true);
        }
        try {
            const page = isGroupThread && chatGroupId
                ? await fetchGroupThreadMessagesPage(chatGroupId, null, 50)
                : await fetchConversationMessagesPage(user.handle, handle, null, 50);
            if (DEBUG_MESSAGE_PAGING) {
                console.info('[RN Messages][dm][initial-page]', {
                    handle: isGroupThread ? chatGroupId : handle,
                    count: page.items.length,
                    nextCursor: page.nextCursor,
                    hasMore: page.hasMore,
                });
            }
            setMessages(dedupeChatMessages(page.items));
            // Re-bind an armed reply target across the reload: if the user tapped
            // Reply on an optimistic/locally-rendered message, its temporary ID
            // no longer exists once server rows land. Swap in the matching server
            // message (same sender + text, close timestamp) so the outgoing
            // mutation carries the real parent ID.
            setReplyingTo((prev) => {
                if (!prev) return prev;
                if (page.items.some((m) => m.id === prev.id)) return prev;
                const match = page.items.find(
                    (m) =>
                        m.senderHandle === prev.senderHandle &&
                        (m.text ?? '') === (prev.text ?? '') &&
                        Math.abs(m.timestamp - prev.timestamp) < 15000,
                );
                return match ?? prev;
            });
            if (isGroupThread && 'groupName' in page && typeof page.groupName === 'string' && page.groupName) {
                setGroupName(page.groupName);
                setGroupAvatarUrl((page as any).groupAvatarUrl || undefined);
            }
            setThreadCursor(page.nextCursor);
            setThreadHasMore(page.hasMore);
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadOlderMessages = async () => {
        if (!user?.handle || !threadHasMore || !threadCursor || loadingOlder) return;
        setLoadingOlder(true);
        try {
            const page = isGroupThread && chatGroupId
                ? await fetchGroupThreadMessagesPage(chatGroupId, threadCursor, 50)
                : await fetchConversationMessagesPage(user.handle, handle, threadCursor, 50);
            if (DEBUG_MESSAGE_PAGING) {
                console.info('[RN Messages][dm][older-page]', {
                    handle: isGroupThread ? chatGroupId : handle,
                    count: page.items.length,
                    requestCursor: threadCursor,
                    nextCursor: page.nextCursor,
                    hasMore: page.hasMore,
                });
            }
            if (page.items.length > 0) {
                setMessages((prev) => dedupeChatMessages([...page.items, ...prev]));
            }
            if (isGroupThread && 'groupName' in page && typeof page.groupName === 'string' && page.groupName) {
                setGroupName(page.groupName);
                setGroupAvatarUrl((page as any).groupAvatarUrl || undefined);
            }
            setThreadCursor(page.nextCursor);
            setThreadHasMore(page.hasMore);
        } catch (error) {
            console.error('Error loading older messages:', error);
        } finally {
            setLoadingOlder(false);
        }
    };

    /** Quote context for whichever send fires next (text, image, sticker, voice). */
    const buildReplyToPayload = (): ChatMessage['replyTo'] => {
        if (!replyingTo) return undefined;
        // Resolve the target against the CURRENT message list at send time, not
        // the object captured when Reply was tapped: an optimistic parent will
        // have been reloaded under its server UUID by now, and that is the ID
        // that must reach the mutation.
        const target = messagesById.get(replyingTo.id) ?? replyingTo;
        const preview = previewFromMessage(target, sharedPosts);
        return {
            messageId: target.id,
            text: preview.text,
            senderHandle: target.senderHandle,
            imageUrl: preview.imageUrl || preview.thumbUrl,
            thumbUrl: preview.thumbUrl || preview.imageUrl,
            // Carry the media type even when the poster hasn't resolved yet
            // (sharedPosts may still be loading) so the quote is never
            // downgraded to a plain text reply on other clients / reload.
            ...(preview.thumbUrl || preview.isVideo
                ? { mediaType: (preview.isVideo ? 'video' : 'image') as 'image' | 'video' }
                : {}),
        };
    };

    /**
     * Swap an optimistic row for its server-persisted row IN PLACE.
     * Never refetch the thread on send: a full reload rebuilds every row,
     * remounting adjacent media (the "Video unavailable" flash) and jumping
     * scroll. The local `replyTo` payload is kept as a fallback so the quoted
     * preview survives even if the server serialization comes back thin;
     * every other row keeps its object identity, so memoized rows don't move.
     */
    const reconcileSentMessage = (optimistic: ChatMessage, serverMsg: ChatMessage | undefined) => {
        if (!serverMsg) return;
        const merged: ChatMessage = {
            ...serverMsg,
            replyTo: serverMsg.replyTo ?? optimistic.replyTo,
            imageUrl: serverMsg.imageUrl ?? optimistic.imageUrl,
            audioUrl: serverMsg.audioUrl ?? optimistic.audioUrl,
            text: serverMsg.text ?? optimistic.text,
        };
        setMessages((prev) =>
            upsertChatMessage(
                prev.filter((m) => m.id !== optimistic.id),
                merged,
            ),
        );
    };

    const handleSend = async () => {
        if (!messageText.trim() || !user?.handle) return;

        const draftText = messageText.trim();
        if (editingMessage) {
            if (isGroupThread) {
                showAlert({
                    title: 'Edit unavailable',
                    message: 'Editing is currently available for direct messages only.',
                    icon: 'info',
                    confirmButtonText: 'OK',
                });
                setEditingMessage(null);
                setMessageText('');
                return;
            }
            try {
                const updated = await editMessage(editingMessage.id, draftText, user.handle, handle);
                if (updated) {
                    setMessages((prev) => prev.map((m) => (m.id === editingMessage.id ? updated : m)));
                }
            } catch (error) {
                console.error('Error editing message:', error);
            } finally {
                setEditingMessage(null);
                setMessageText('');
            }
            return;
        }

        const replyToPayload = buildReplyToPayload();

        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            senderHandle: user.handle,
            text: draftText,
            timestamp: Date.now(),
            replyTo: replyToPayload,
        };

        shouldAutoScrollRef.current = true;
        setMessages((prev) => upsertChatMessage(prev, newMessage));
        setMessageText('');
        scrollMessagesToBottom(true);

        try {
            const serverMsg =
                isGroupThread && chatGroupId
                    ? await appendGroupChatMessage(user.handle, chatGroupId, { text: newMessage.text, replyTo: replyToPayload })
                    : await appendMessage(user.handle, handle, { text: newMessage.text, replyTo: replyToPayload });
            // Optimistic row is safely in the list with its quote intact —
            // swap in the server row (real UUID/timestamp) and only then
            // consume the reply state.
            reconcileSentMessage(newMessage, serverMsg);
            setReplyingTo(null);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const openMessageActions = (item: ChatMessage) => {
        setMessageActionsTarget(item);
    };

    const closeMessageActions = () => setMessageActionsTarget(null);

    const messageActionList = (item: ChatMessage): DmMessageAction[] => {
        const fromMe = sameDmHandle(item.senderHandle, user?.handle);
        const actions: DmMessageAction[] = [
            {
                key: 'reply',
                label: 'Reply',
                icon: 'arrow-undo',
                onPress: () => {
                    setReplyingTo(item);
                    setEditingMessage(null);
                },
            },
        ];
        if (item.storyId) {
            actions.push({
                key: 'view-story',
                label: 'View story',
                icon: 'image-outline',
                onPress: () => {
                    navigation.navigate('Stories', {
                        openUserHandle: item.senderHandle || handle,
                        openStoryId: item.storyId,
                    });
                },
            });
        }
        if (fromMe && !isGroupThread) {
            actions.unshift({
                key: 'edit',
                label: 'Edit',
                icon: 'create-outline',
                onPress: () => {
                    setEditingMessage(item);
                    setReplyingTo(null);
                    setMessageText(item.text || '');
                },
            });
        }
        actions.push({
            key: 'sticker',
            label: 'Add sticker',
            icon: 'happy-outline',
            onPress: () => {
                setStickerTargetMessageId(item.id);
                setShowStickerPicker(true);
            },
        });
        actions.push({
            key: 'forward',
            label: 'Forward',
            icon: 'share-outline',
            onPress: () => {
                void handleForwardMessage(item);
            },
        });
        if (item.text) {
            actions.push({
                key: 'copy',
                label: 'Copy text',
                icon: 'copy-outline',
                onPress: () => {
                    Clipboard.setString(item.text || '');
                    showAlert({
                        title: 'Copied',
                        message: 'Message text copied to clipboard.',
                        icon: 'success',
                        confirmButtonText: 'OK',
                    });
                },
            });
            actions.push({
                key: 'translate',
                label: translatedMessages[item.id] ? 'Hide translation' : 'Translate',
                icon: 'language-outline',
                onPress: () => {
                    void handleTranslateMessage(item);
                },
            });
        }
        if (!fromMe) {
            actions.push({
                key: 'profile',
                label: 'View profile',
                icon: 'person-outline',
                onPress: () => {
                    navigation.navigate('ViewProfile', { handle: item.senderHandle });
                },
            });
        }
        actions.push({
            key: 'report',
            label: 'Report',
            icon: 'alert-circle-outline',
            destructive: true,
            onPress: () => {
                handleReportMessage(item);
            },
        });
        return actions;
    };

    const translateText = async (text: string): Promise<string> => {
        // Placeholder parity behavior; wire real translation API in a later backend pass.
        return new Promise((resolve) => {
            setTimeout(() => resolve(`[Translated] ${text}`), 260);
        });
    };

    const handleTranslateMessage = async (item: ChatMessage) => {
        if (!item.text) return;
        if (translatedMessages[item.id]) {
            setTranslatedMessages((prev) => {
                const next = { ...prev };
                delete next[item.id];
                return next;
            });
            return;
        }
        try {
            const translated = await translateText(item.text);
            setTranslatedMessages((prev) => ({ ...prev, [item.id]: translated }));
        } catch {
            showAlert({
                title: 'Translate failed',
                message: 'Could not translate this message right now.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
        }
    };

    const handleForwardMessage = async (item: ChatMessage) => {
        if (!user?.handle) return;
        try {
            const conversations = await listConversations(user.handle);
            const dmTargets = conversations
                .filter((conv) => conv.kind === 'dm' && !!conv.otherHandle)
                .map((conv) => conv.otherHandle)
                .filter((target) => !isGroupThread ? target !== handle : true)
                .slice(0, 8);
            if (dmTargets.length === 0) {
                showAlert({
                    title: 'No conversations',
                    message: 'No other direct conversations available to forward to.',
                    icon: 'info',
                    confirmButtonText: 'OK',
                });
                return;
            }
            showMenu({
                title: 'Forward message',
                subtitle: 'Choose conversation',
                options: dmTargets.map((target) => ({
                    label: target,
                    onPress: () => {
                        void (async () => {
                            try {
                                await appendMessage(user.handle, target, {
                                    text: item.text ? `Forwarded: ${item.text}` : undefined,
                                    imageUrl: item.imageUrl,
                                    audioUrl: item.audioUrl,
                                });
                                showAlert({
                                    title: 'Forwarded',
                                    message: `Sent to ${target}`,
                                    icon: 'success',
                                    confirmButtonText: 'OK',
                                });
                            } catch {
                                showAlert({
                                    title: 'Forward failed',
                                    message: 'Could not forward this message right now.',
                                    icon: 'alert',
                                    confirmButtonText: 'OK',
                                });
                            }
                        })();
                    },
                })),
            });
        } catch {
            showAlert({
                title: 'Forward failed',
                message: 'Could not load conversations right now.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
        }
    };

    const handleReportMessage = (item: ChatMessage) => {
        showMenu({
            title: 'Report message',
            subtitle: `Why are you reporting ${item.senderHandle}'s message?`,
            options: [
                {
                    label: 'Spam',
                    onPress: () => {
                        showAlert({
                            title: 'Reported',
                            message: 'Thanks. We have flagged this message for spam review.',
                            icon: 'success',
                            confirmButtonText: 'OK',
                        });
                    },
                },
                {
                    label: 'Harassment',
                    onPress: () => {
                        showAlert({
                            title: 'Reported',
                            message: 'Thanks. We have flagged this message for harassment review.',
                            icon: 'success',
                            confirmButtonText: 'OK',
                        });
                    },
                },
                {
                    label: 'Other',
                    onPress: () => {
                        showAlert({
                            title: 'Reported',
                            message: 'Thanks. We have flagged this message for review.',
                            icon: 'success',
                            confirmButtonText: 'OK',
                        });
                    },
                    destructive: true,
                },
            ],
        });
    };

    const handleToggleReaction = (messageId: string, emoji: string) => {
        if (!user?.handle) return;
        setMessageReactions((prev) => {
            const existing = prev[messageId] || [];
            const next = [...existing];
            const reactionIdx = next.findIndex((r) => r.emoji === emoji);
            if (reactionIdx >= 0) {
                const users = next[reactionIdx].users;
                if (users.includes(user.handle)) {
                    const filteredUsers = users.filter((u) => u !== user.handle);
                    if (filteredUsers.length === 0) {
                        next.splice(reactionIdx, 1);
                    } else {
                        next[reactionIdx] = { ...next[reactionIdx], users: filteredUsers };
                    }
                } else {
                    next[reactionIdx] = { ...next[reactionIdx], users: [...users, user.handle] };
                }
            } else {
                next.push({ emoji, users: [user.handle] });
            }
            return { ...prev, [messageId]: next };
        });
    };

    /** Instagram-style: add reaction, then pop → fly into the pill on the bubble. */
    const handleReactWithAnimation = (messageId: string, emoji: string) => {
        if (!user?.handle) return;
        const existing = messageReactions[messageId] || [];
        const reaction = existing.find((r) => r.emoji === emoji);
        const removing = !!reaction?.users.includes(user.handle);
        handleToggleReaction(messageId, emoji);
        if (removing) return;
        setReactionFly({ messageId, emoji, target: null });
    };

    const pickGroupAvatar = () => {
        launchImageLibrary(
            {
                mediaType: 'photo',
                selectionLimit: 1,
                includeBase64: true,
                quality: 0.8,
            },
            (response) => {
                if (response.didCancel) return;
                if (response.errorCode) {
                    showAlert({
                        title: 'Photo error',
                        message: response.errorMessage || 'Could not open your photo library.',
                        icon: 'alert',
                        confirmButtonText: 'OK',
                    });
                    return;
                }
                const asset = response.assets?.[0];
                if (!asset) return;
                const uri = asset.uri;
                if (!uri) return;
                setNewGroupAvatarDataUrl(uri);
            },
        );
    };

    const handleCreateGroup = async () => {
        if (!user?.handle || creatingGroup) return;
        const trimmed = newGroupName.trim();
        if (!trimmed) {
            showAlert({
                title: 'Group name required',
                message: 'Enter a group name to continue.',
                icon: 'info',
                confirmButtonText: 'OK',
            });
            return;
        }
        setCreatingGroup(true);
        try {
            let avatarUrl: string | null = null;
            if (newGroupAvatarDataUrl) {
                if (isLaravelApiEnabled()) {
                    const upload = await uploadFileFromUri(newGroupAvatarDataUrl);
                    avatarUrl = upload.fileUrl || upload.url || null;
                    if (!avatarUrl) {
                        throw new Error('Could not upload group photo');
                    }
                } else {
                    avatarUrl = newGroupAvatarDataUrl;
                }
            }
            const created = await createChatGroup(trimmed, user.handle, avatarUrl);
            if (!created?.id) {
                showAlert({
                    title: 'Create failed',
                    message: 'Could not create group right now.',
                    icon: 'alert',
                    confirmButtonText: 'OK',
                });
                return;
            }
            setCreateGroupOpen(false);
            setNewGroupName('');
            setNewGroupAvatarDataUrl(undefined);
            navigation.replace('Messages', {
                chatGroupId: created.id,
                kind: 'group',
                groupName: trimmed,
            });
        } catch (error) {
            console.error('Error creating group:', error);
            showAlert({
                title: 'Create failed',
                message: 'Could not create group right now.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
        } finally {
            setCreatingGroup(false);
        }
    };

    const handleInviteMember = async () => {
        if (!chatGroupId || inviteBusy) return;
        if (!isGroupAdmin) {
            showAlert({
                title: 'Invite failed',
                message: 'Only group admins can send invites.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
            return;
        }
        const normalized = inviteHandle.trim().replace(/^@/, '');
        if (!normalized) {
            showAlert({
                title: 'Handle required',
                message: 'Type a handle to invite.',
                icon: 'info',
                confirmButtonText: 'OK',
            });
            return;
        }
        setInviteBusy(true);
        try {
            const result = (await inviteUserToChatGroup(chatGroupId, normalized)) as {
                inviteeHandle?: string;
            };
            const invited = result?.inviteeHandle || normalized;
            setInviteOpen(false);
            setInviteHandle('');
            setInviteSuggestions([]);
            showAlert({
                title: isLaravelApiEnabled() ? 'Invite sent' : 'Member added',
                message: isLaravelApiEnabled()
                    ? `@${invited} will see this invite in notifications.`
                    : `${invited} was added to this group (mock mode — no server notifications).`,
                icon: 'success',
                confirmButtonText: 'OK',
            });
        } catch (error) {
            const apiBody =
                error && typeof error === 'object' && 'response' in error
                    ? (error as { response?: { error?: string; message?: string; errors?: unknown } }).response
                    : undefined;
            console.error('Invite failed:', error, apiBody);
            const apiMessage =
                (typeof apiBody?.message === 'string' && apiBody.message) ||
                (typeof apiBody?.error === 'string' && apiBody.error) ||
                (error instanceof Error ? error.message : null);
            showAlert({
                title: 'Invite failed',
                message: apiMessage || 'Could not send invite right now.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
        } finally {
            setInviteBusy(false);
        }
    };

    const openHeaderActions = () => {
        setShowChatInfo(true);
    };

    const formatMessageClock = (ts: number) => {
        try {
            return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return timeAgo(ts);
        }
    };

    const handleToggleDmBubbleStyle = async (style: DmSentBubbleStyle) => {
        setDmSentStyle(style);
        await setDmSentBubblePreference(style);
    };

    const handleToggleMuteFromSheet = async () => {
        if (!user?.handle || !handle || isGroupThread) return;
        try {
            if (isMuted) {
                await unmuteConversation(user.handle, handle);
                setIsMuted(false);
            } else {
                await muteConversation(user.handle, handle);
                setIsMuted(true);
            }
            setShowChatInfo(false);
        } catch {
            showAlert({
                title: 'Action failed',
                message: 'Could not update mute state right now.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
        }
    };

    const handleImageClick = () => {
        if (!user?.handle) return;
        launchImageLibrary(
            {
                mediaType: 'photo',
                selectionLimit: 1,
                includeBase64: true,
                quality: 0.8,
            },
            async (response) => {
                if (response.didCancel) return;
                if (response.errorCode) {
                    showAlert({
                        title: 'Image error',
                        message: response.errorMessage || 'Could not open your photo library.',
                        icon: 'alert',
                        confirmButtonText: 'OK',
                    });
                    return;
                }
                const asset = response.assets?.[0];
                if (!asset) return;
                const mime = asset.type || 'image/jpeg';
                const imageUrl = asset.base64
                    ? `data:${mime};base64,${asset.base64}`
                    : asset.uri;
                if (!imageUrl) return;
                setImageCompose({ imageUrl, caption: '' });
            },
        );
    };

    const handleCancelImageCompose = () => {
        setImageCompose(null);
    };

    const handleSendImageWithCaption = async () => {
        if (!imageCompose || !user?.handle) return;
        const trimmedCaption = imageCompose.caption.trim();
        const replyToPayload = buildReplyToPayload();
        const optimistic: ChatMessage = {
            id: `${Date.now()}-img`,
            senderHandle: user.handle,
            imageUrl: imageCompose.imageUrl,
            text: trimmedCaption || undefined,
            timestamp: Date.now(),
            replyTo: replyToPayload,
        };
        setImageCompose(null);
        shouldAutoScrollRef.current = true;
        setMessages((prev) => upsertChatMessage(prev, optimistic));
        try {
            const serverMsg =
                isGroupThread && chatGroupId
                    ? await appendGroupChatMessage(user.handle, chatGroupId, { imageUrl: optimistic.imageUrl, text: optimistic.text, replyTo: replyToPayload })
                    : await appendMessage(user.handle, handle, { imageUrl: optimistic.imageUrl, text: optimistic.text, replyTo: replyToPayload });
            reconcileSentMessage(optimistic, serverMsg);
        } catch (error) {
            console.error('Error sending image message:', error);
            showAlert({
                title: 'Send failed',
                message: 'Could not send image message.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
        } finally {
            // Quote is consumed by this send — never carry it into the next message.
            setReplyingTo(null);
        }
    };

    const handleSendSticker = async (emoji: string) => {
        if (!user?.handle || !emoji) return;
        if (stickerTargetMessageId) {
            handleReactWithAnimation(stickerTargetMessageId, emoji);
            setStickerTargetMessageId(null);
            setShowStickerPicker(false);
            return;
        }
        const replyToPayload = buildReplyToPayload();
        const optimistic: ChatMessage = {
            id: `${Date.now()}-sticker`,
            senderHandle: user.handle,
            text: emoji,
            timestamp: Date.now(),
            replyTo: replyToPayload,
        };
        setShowStickerPicker(false);
        shouldAutoScrollRef.current = true;
        setMessages((prev) => upsertChatMessage(prev, optimistic));
        try {
            const serverMsg =
                isGroupThread && chatGroupId
                    ? await appendGroupChatMessage(user.handle, chatGroupId, { text: emoji, replyTo: replyToPayload })
                    : await appendMessage(user.handle, handle, { text: emoji, replyTo: replyToPayload });
            reconcileSentMessage(optimistic, serverMsg);
        } catch (error) {
            console.error('Error sending sticker:', error);
            showAlert({
                title: 'Send failed',
                message: 'Could not send sticker.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
        } finally {
            setReplyingTo(null);
        }
    };

    const requestMicPermission = async () => {
        if (Platform.OS !== 'android') return true;
        try {
            const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
                title: 'Microphone Permission',
                message: 'Clips needs microphone access to send voice messages.',
                buttonPositive: 'Allow',
                buttonNegative: 'Deny',
            });
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch {
            return false;
        }
    };

    const formatVoiceDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const normalizePlaybackUri = (uri: string) => {
        const trimmed = uri.trim();
        if (!trimmed) return trimmed;
        if (
            trimmed.startsWith('file://') ||
            trimmed.startsWith('content://') ||
            trimmed.startsWith('http://') ||
            trimmed.startsWith('https://') ||
            trimmed.startsWith('data:')
        ) {
            return trimmed;
        }
        return toFileUri(trimmed);
    };

    const buildVoiceDraftFromSegments = (segments: VoiceDraftSegment[]): VoiceDraftState => {
        const durationSeconds = Math.max(
            1,
            segments.reduce((sum, segment) => sum + segment.durationSeconds, 0),
        );
        let elapsed = 0;
        const offsets = segments.map((segment) => {
            const start = elapsed;
            elapsed += segment.durationSeconds;
            return start;
        });
        voiceDraftSegmentOffsetsRef.current = offsets.length ? offsets : [0];
        const latest = segments[segments.length - 1];
        return {
            audioUrl: latest.audioUrl,
            durationSeconds,
            segments,
            canContinue: true,
        };
    };

    const clearVoiceSegments = () => {
        voiceSegmentsRef.current = [];
        voiceDraftSegmentOffsetsRef.current = [0];
        voiceDraftSegmentIndexRef.current = 0;
    };

    const resolveVoiceDraftAudioUrl = async (draft: VoiceDraftState): Promise<string | null> => {
        const segments = draft.segments?.length
            ? draft.segments
            : [{ audioUrl: draft.audioUrl, durationSeconds: draft.durationSeconds }];
        const urls = segments.map((segment) => segment.audioUrl).filter(Boolean);
        if (!urls.length) return null;
        if (urls.length === 1) return urls[0];

        const { makeSiblingOutputPath, toFfmpegPath, executeFfmpeg } = await import('../utils/ffmpegNative');
        const outputPath = makeSiblingOutputPath(urls[0], 'voice', 'm4a');
        const inputs = urls.map((url) => `-i "${toFfmpegPath(url)}"`).join(' ');
        const filterInputs = urls.map((_, index) => `[${index}:a]`).join('');
        const filter = `${filterInputs}concat=n=${urls.length}:v=0:a=1[outa]`;
        await executeFfmpeg(`-y ${inputs} -filter_complex "${filter}" -map "[outa]" "${outputPath}"`);
        return toFileUri(outputPath);
    };

    const stopVoiceDraftPlayback = async () => {
        voiceDraftPlayingRef.current = false;
        voiceDraftSegmentIndexRef.current = 0;
        try {
            await audioRecorderRef.current.stopPlayer();
            audioRecorderRef.current.removePlayBackListener();
        } catch {
            // ignore
        }
        setIsPlayingVoiceDraft(false);
    };

    const resetVoiceCaptureState = () => {
        setIsRecordingVoice(false);
        setRecordingSeconds(0);
        setRecordingGestureHint('none');
        recordingPathRef.current = null;
        recorderSessionActiveRef.current = false;
    };

    const startVoiceRecording = async (appendSegment = false) => {
        if (!user?.handle || isRecordingVoice) return false;
        if (voiceDraft && !appendSegment) return false;
        const allowed = await requestMicPermission();
        if (!allowed) {
            showAlert({
                title: 'Permission required',
                message: 'Microphone permission is required to record voice messages.',
                icon: 'info',
                confirmButtonText: 'OK',
            });
            return false;
        }
        try {
            setRecordingSeconds(0);
            const path = await audioRecorderRef.current.startRecorder();
            recordingPathRef.current = path || null;
            recorderSessionActiveRef.current = true;
            audioRecorderRef.current.addRecordBackListener((event: any) => {
                const secs = Math.max(0, Math.floor((event.currentPosition || 0) / 1000));
                setRecordingSeconds(secs);
            });
            setIsRecordingVoice(true);
            return true;
        } catch (error) {
            console.error('Voice record start failed:', error);
            resetVoiceCaptureState();
            showAlert({
                title: 'Record failed',
                message: 'Could not start voice recording.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
            return false;
        }
    };

    const cancelVoiceRecording = async () => {
        try {
            if (recorderSessionActiveRef.current) {
                await audioRecorderRef.current.stopRecorder();
                audioRecorderRef.current.removeRecordBackListener();
            }
        } catch {
            // ignore
        }
        await stopVoiceDraftPlayback();
        resetVoiceCaptureState();
        clearVoiceSegments();
        setVoiceDraft(null);
    };

    const pauseVoiceRecordingForPreview = async () => {
        if (!isRecordingVoiceRef.current || !recorderSessionActiveRef.current) return;
        const durationSeconds = Math.max(1, recordingSeconds);
        try {
            audioRecorderRef.current.removeRecordBackListener();
            const stoppedPath = await audioRecorderRef.current.stopRecorder();
            recorderSessionActiveRef.current = false;
            setIsRecordingVoice(false);
            setRecordingGestureHint('none');
            await stopVoiceDraftPlayback();

            const previewUrl = normalizePlaybackUri(stoppedPath || recordingPathRef.current || '');
            if (!previewUrl) return;

            const segments = [
                ...voiceSegmentsRef.current,
                { audioUrl: previewUrl, durationSeconds },
            ];
            voiceSegmentsRef.current = segments;
            recordingPathRef.current = previewUrl;
            setVoiceDraft(buildVoiceDraftFromSegments(segments));
        } catch (error) {
            console.error('Voice preview finalize failed:', error);
            await cancelVoiceRecording();
            showAlert({
                title: 'Record failed',
                message: 'Could not finish voice recording for preview.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
        }
    };

    const continueVoiceRecording = async () => {
        if (!voiceDraft?.canContinue || recorderSessionActiveRef.current) return;
        try {
            await stopVoiceDraftPlayback();
            setVoiceDraft(null);
            const started = await startVoiceRecording(true);
            if (!started) return;
        } catch (error) {
            console.error('Voice resume failed:', error);
            showAlert({
                title: 'Record failed',
                message: 'Could not continue voice recording.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
        }
    };

    const discardVoiceDraft = async () => {
        await stopVoiceDraftPlayback();
        if (recorderSessionActiveRef.current) {
            await cancelVoiceRecording();
            return;
        }
        clearVoiceSegments();
        setVoiceDraft(null);
        setVoiceDraftPlaySeconds(0);
    };

    const sendVoiceDraft = async () => {
        if (!voiceDraft || !user?.handle) return;
        try {
            const audioUrl = await resolveVoiceDraftAudioUrl(voiceDraft);
            if (!audioUrl) {
                showAlert({
                    title: 'Send failed',
                    message: 'Could not prepare voice message.',
                    icon: 'alert',
                    confirmButtonText: 'OK',
                });
                return;
            }
            const replyToPayload = buildReplyToPayload();
            const optimistic: ChatMessage = {
                id: `${Date.now()}-audio`,
                senderHandle: user.handle,
                audioUrl,
                timestamp: Date.now(),
                replyTo: replyToPayload,
            };
            shouldAutoScrollRef.current = true;
            setMessages((prev) => upsertChatMessage(prev, optimistic));
            const serverMsg =
                isGroupThread && chatGroupId
                    ? await appendGroupChatMessage(user.handle, chatGroupId, { audioUrl, replyTo: replyToPayload })
                    : await appendMessage(user.handle, handle, { audioUrl, replyTo: replyToPayload });
            reconcileSentMessage(optimistic, serverMsg);
            setReplyingTo(null);
            clearVoiceSegments();
            setVoiceDraft(null);
            setVoiceDraftPlaySeconds(0);
            recordingPathRef.current = null;
        } catch (error) {
            console.error('Voice send failed:', error);
            showAlert({
                title: 'Send failed',
                message: 'Could not send voice message.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
        }
    };

    const seekVoiceDraftPlayback = async (seconds: number) => {
        if (!voiceDraft?.audioUrl) return;
        const clamped = Math.max(0, Math.min(voiceDraft.durationSeconds, seconds));
        setVoiceDraftPlaySeconds(clamped);
        try {
            await audioRecorderRef.current.seekToPlayer(clamped * 1000);
        } catch {
            // ignore seek failures on partial files
        }
    };

    const handleVoiceDraftTrackPress = (locationX: number) => {
        if (!voiceDraftTrackWidth || !voiceDraft?.durationSeconds) return;
        const ratio = Math.max(0, Math.min(1, locationX / voiceDraftTrackWidth));
        void seekVoiceDraftPlayback(Math.floor(ratio * voiceDraft.durationSeconds));
    };

    const playVoiceDraftSegment = async (segmentIndex: number, offsetSeconds = 0) => {
        if (!voiceDraft) return;
        const segments = voiceDraft.segments?.length
            ? voiceDraft.segments
            : [{ audioUrl: voiceDraft.audioUrl, durationSeconds: voiceDraft.durationSeconds }];
        if (segmentIndex >= segments.length) {
            await stopVoiceDraftPlayback();
            return;
        }

        const segment = segments[segmentIndex];
        const playbackUri = normalizePlaybackUri(segment.audioUrl);
        voiceDraftSegmentIndexRef.current = segmentIndex;

        await audioRecorderRef.current.stopPlayer();
        audioRecorderRef.current.removePlayBackListener();
        await audioRecorderRef.current.startPlayer(playbackUri);
        if (offsetSeconds > 0) {
            try {
                await audioRecorderRef.current.seekToPlayer(offsetSeconds * 1000);
            } catch {
                // seek may fail on some devices until playback starts
            }
        }

        voiceDraftPlayingRef.current = true;
        setIsPlayingVoiceDraft(true);
        const segmentStart = voiceDraftSegmentOffsetsRef.current[segmentIndex] ?? 0;

        audioRecorderRef.current.addPlayBackListener((event: any) => {
            const localSecs = Math.max(0, Math.floor((event.currentPosition || 0) / 1000));
            setVoiceDraftPlaySeconds(segmentStart + localSecs);
            const durationMs = event.duration || 0;
            const reachedEnd =
                (durationMs > 0 && event.currentPosition >= durationMs - 80) ||
                localSecs >= segment.durationSeconds;
            if (reachedEnd) {
                audioRecorderRef.current.removePlayBackListener();
                void playVoiceDraftSegment(segmentIndex + 1, 0);
            }
        });
    };

    const toggleVoiceDraftPlayback = async () => {
        if (!voiceDraft?.audioUrl) return;
        if (isPlayingVoiceDraft) {
            await stopVoiceDraftPlayback();
            return;
        }
        try {
            const segments = voiceDraft.segments?.length
                ? voiceDraft.segments
                : [{ audioUrl: voiceDraft.audioUrl, durationSeconds: voiceDraft.durationSeconds }];
            const offsets = voiceDraftSegmentOffsetsRef.current;
            let startSegment = 0;
            let offsetInSegment = voiceDraftPlaySeconds;
            for (let i = 0; i < segments.length; i += 1) {
                const segmentStart = offsets[i] ?? 0;
                const segmentEnd = segmentStart + segments[i].durationSeconds;
                if (voiceDraftPlaySeconds < segmentEnd || i === segments.length - 1) {
                    startSegment = i;
                    offsetInSegment = Math.max(0, voiceDraftPlaySeconds - segmentStart);
                    break;
                }
            }
            await playVoiceDraftSegment(startSegment, offsetInSegment);
        } catch (error) {
            console.error('Voice preview playback failed:', error);
            await stopVoiceDraftPlayback();
            showAlert({
                title: 'Playback failed',
                message: 'Could not preview this voice message.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
        }
    };

    // Re-point the top-block actions ref at the real handlers (not a hook).
    voiceMicActionsRef.current = {
        startVoiceRecording,
        pauseVoiceRecordingForPreview,
        cancelVoiceRecording,
    };

    const handlePlayAudioMessage = async (audioUrl?: string) => {
        if (!audioUrl) return;
        try {
            await audioRecorderRef.current.stopPlayer();
            audioRecorderRef.current.removePlayBackListener();
            await audioRecorderRef.current.startPlayer(normalizePlaybackUri(audioUrl));
            setPlayingAudioId(audioUrl);
            audioRecorderRef.current.addPlayBackListener((event: any) => {
                if (event.currentPosition >= event.duration) {
                    void audioRecorderRef.current.stopPlayer();
                    audioRecorderRef.current.removePlayBackListener();
                    setPlayingAudioId(null);
                }
            });
        } catch {
            try {
                const supported = await Linking.canOpenURL(audioUrl);
                if (!supported) {
                    showAlert({
                        title: 'Playback unavailable',
                        message: 'This voice message cannot be played on this device.',
                        icon: 'info',
                        confirmButtonText: 'OK',
                    });
                    return;
                }
                await Linking.openURL(audioUrl);
            } catch {
                showAlert({
                    title: 'Playback failed',
                    message: 'Could not open this voice message.',
                    icon: 'alert',
                    confirmButtonText: 'OK',
                });
            }
        }
    };

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const sharedRef = getMessageSharedRef(item);
        const sharedKey = sharedRef ? sharedPostRefKey(sharedRef) : null;
        return (
            <DmMessageRow
                message={item}
                userHandle={user?.handle}
                userId={user?.id}
                threadHandle={handle}
                isGroupThread={isGroupThread}
                dmSentStyle={dmSentStyle}
                translatedText={translatedMessages[item.id]}
                reactions={messageReactions[item.id]}
                isPlayingAudio={Boolean(item.audioUrl) && playingAudioId === item.audioUrl}
                isSwiping={swipingMessageId === item.id}
                isActive={isScreenFocused && activeMessageIds.has(item.id)}
                replyPreview={resolveReplyPreview(item, messagesById, sharedPosts)}
                reactionFlyEmoji={
                    reactionFly && reactionFly.messageId === item.id && !reactionFly.target
                        ? reactionFly.emoji
                        : null
                }
                sharedPost={sharedKey ? sharedPosts[sharedKey] ?? null : null}
                swipeAnim={swipeAnim}
                navigation={navigation}
                setReplyingTo={setReplyingTo}
                setEditingMessage={setEditingMessage}
                setSwipingMessageId={setSwipingMessageId}
                swipeMessageIdRef={swipeMessageIdRef}
                reactionPillRefs={reactionPillRefs}
                handlers={rowHandlersRef}
            />
        );
    };

    rowHandlersRef.current = {
        openMessageActions,
        handleToggleReaction,
        handleReactWithAnimation,
        handlePlayAudioMessage,
        openScenesForPost,
        openScenesForRef,
        formatMessageClock,
        isLikelyVideoUrl,
    };

    return (
        <GazetteerScreenShell ambient={false} style={styles.pageShell}>
            <LinearGradient
                colors={['rgba(32,38,48,0.82)', 'rgba(11,14,19,0.94)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn} hitSlop={8}>
                    <Icon name="chevron-back" size={ox(26)} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <View style={styles.headerAvatarWrap}>
                        <TouchableOpacity
                            onPress={() => {
                                if (isGroupThread || !handle) return;
                                navigation.navigate('ViewProfile', { handle });
                            }}
                            disabled={isGroupThread}
                        >
                            <Avatar
                                src={isGroupThread ? groupAvatarUrl : getAvatarForHandle(handle)}
                                name={
                                    isGroupThread
                                        ? groupName || 'Group'
                                        : handle?.split('@')[0] || 'User'
                                }
                                size={ox(36)}
                            />
                        </TouchableOpacity>
                        {!isGroupThread &&
                        user?.handle &&
                        handle &&
                        handle !== user.handle &&
                        !isFollowing ? (
                            <TouchableOpacity
                                style={[
                                    styles.followBadge,
                                    {
                                        backgroundColor: dmSentBubbleColor(dmSentStyle),
                                    },
                                ]}
                                onPress={() => {
                                    void handleFollowFromHeader();
                                }}
                                disabled={isFollowLoading}
                                accessibilityLabel={
                                    followRequestPending ? 'Cancel follow request' : 'Follow user'
                                }
                            >
                                <Icon
                                    name={followRequestPending ? 'time-outline' : 'add'}
                                    size={ox(12)}
                                    color="#FFFFFF"
                                />
                            </TouchableOpacity>
                        ) : null}
                        {!isGroupThread &&
                        user?.handle &&
                        handle &&
                        handle !== user.handle &&
                        isFollowing &&
                        showFollowCheck ? (
                            <View style={[styles.followBadge, styles.followBadgeCheck]}>
                                <Icon name="checkmark" size={ox(12)} color="#FFFFFF" />
                            </View>
                        ) : null}
                    </View>
                    <View style={styles.headerTextCol}>
                        <TouchableOpacity
                            onPress={() => {
                                if (isGroupThread || !handle) return;
                                navigation.navigate('ViewProfile', { handle });
                            }}
                            disabled={isGroupThread}
                        >
                            <Text style={styles.headerName} numberOfLines={1}>
                                {isGroupThread ? groupName : handle}
                            </Text>
                        </TouchableOpacity>
                        <Text style={styles.headerSubtitle}>
                            {isGroupThread ? 'Group chat' : 'Active now'}
                        </Text>
                    </View>
                </View>
                <View style={styles.headerActions}>
                    {!isGroupThread && handle ? (
                        <TouchableOpacity
                            onPress={openPlacesTraveled}
                            style={styles.headerActionButton}
                            accessibilityLabel="Places traveled"
                        >
                            <Icon name="location-outline" size={ox(22)} color="#FFFFFF" />
                        </TouchableOpacity>
                    ) : null}
                    {isGroupThread && isGroupAdmin ? (
                        <TouchableOpacity
                            onPress={() => setInviteOpen(true)}
                            style={styles.headerActionButton}
                            accessibilityLabel="Invite to group"
                        >
                            <Icon name="person-add-outline" size={ox(22)} color="#FFFFFF" />
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity style={styles.headerActionButton} onPress={openHeaderActions}>
                        <Icon name="ellipsis-horizontal" size={ox(22)} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardView}
                keyboardVerticalOffset={0}
            >
                <FlatList
                    ref={flatListRef}
                    data={visibleMessages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    style={styles.messagesList}
                    initialNumToRender={14}
                    maxToRenderPerBatch={10}
                    windowSize={11}
                    updateCellsBatchingPeriod={50}
                    removeClippedSubviews={false}
                    keyboardShouldPersistTaps="handled"
                    viewabilityConfig={viewabilityConfig}
                    onViewableItemsChanged={onViewableItemsChanged}
                    contentContainerStyle={[
                        styles.messagesContent,
                        messages.length === 0 ? styles.messagesContentEmpty : null,
                    ]}
                    maintainVisibleContentPosition={
                        mvcpEnabled
                            ? {
                                  minIndexForVisible: 0,
                                  autoscrollToTopThreshold: 12,
                              }
                            : undefined
                    }
                    onContentSizeChange={() => {
                        // Never spend the auto-scroll flag on the empty/loading
                        // layout pass — only on real message content.
                        if (messages.length === 0) return;
                        if (shouldAutoScrollRef.current) {
                            scrollMessagesToBottom(true);
                            shouldAutoScrollRef.current = false;
                        }
                    }}
                    onScroll={(e) => {
                        if (e.nativeEvent.contentOffset.y <= 120) {
                            loadOlderMessages();
                        }
                    }}
                    scrollEventThrottle={16}
                    ListHeaderComponent={loadingOlder ? (
                        <View style={styles.loadingOlderWrap}>
                            <ActivityIndicator size="small" color="#8B5CF6" />
                            <Text style={styles.loadingOlderText}>Loading older messages...</Text>
                        </View>
                    ) : null}
                    ListEmptyComponent={
                        loading ? (
                            <View style={styles.threadLoadingWrap}>
                                <ActivityIndicator size="large" color="#f472b6" />
                            </View>
                        ) : null
                    }
                />

                {(replyingTo || editingMessage) && (
                    <Animated.View
                        style={[
                            styles.composerContextWrap,
                            {
                                opacity: replyBarAnim,
                                transform: [
                                    {
                                        translateY: replyBarAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [10, 0],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        {editingMessage ? (
                            <View style={styles.composerEditingBody}>
                                <Text style={styles.composerContextTitle}>Editing message</Text>
                                <Text style={styles.composerContextText} numberOfLines={1}>
                                    {editingMessage.text || 'Message'}
                                </Text>
                            </View>
                        ) : replyingTo ? (
                            <DmQuotedReply
                                variant="composer"
                                preview={previewFromMessage(replyingTo, sharedPosts)}
                            />
                        ) : null}
                        <TouchableOpacity
                            onPress={() => {
                                setReplyingTo(null);
                                setEditingMessage(null);
                                setMessageText('');
                            }}
                        >
                            <Icon name="close" size={ox(18)} color="#9CA3AF" />
                        </TouchableOpacity>
                    </Animated.View>
                )}
                {imageCompose && (
                    <View style={styles.imageComposeWrap}>
                        <Image source={{ uri: imageCompose.imageUrl }} style={styles.imageComposePreview} />
                        <View style={styles.imageComposeBody}>
                            <Text style={styles.imageComposeTitle}>Image preview</Text>
                            <TextInput
                                value={imageCompose.caption}
                                onChangeText={(caption) => setImageCompose((prev) => (prev ? { ...prev, caption } : prev))}
                                placeholder="Add a caption (optional)"
                                placeholderTextColor="#6B7280"
                                style={styles.imageComposeInput}
                                maxLength={280}
                            />
                            <View style={styles.imageComposeActions}>
                                <TouchableOpacity style={styles.imageComposeCancelBtn} onPress={handleCancelImageCompose}>
                                    <Text style={styles.imageComposeCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.imageComposeSendBtn} onPress={handleSendImageWithCaption}>
                                    <Text style={styles.imageComposeSendText}>Send</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
                {ENABLE_VOICE_NOTES && voiceDraft ? (
                    <View style={styles.voiceReviewSection}>
                        <Text style={styles.voiceReviewLabel}>Review before sending</Text>
                        <View style={styles.voiceReviewBar}>
                            <TouchableOpacity
                                style={styles.voiceReviewIconBtn}
                                onPress={() => {
                                    void discardVoiceDraft();
                                }}
                                accessibilityLabel="Delete voice note"
                            >
                                <Icon name="trash-outline" size={ox(20)} color="#9CA3AF" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.voiceReviewPlayBtn}
                                onPress={() => {
                                    void toggleVoiceDraftPlayback();
                                }}
                                accessibilityLabel={isPlayingVoiceDraft ? 'Pause preview' : 'Play preview'}
                            >
                                <Icon
                                    name={isPlayingVoiceDraft ? 'pause' : 'play'}
                                    size={ox(18)}
                                    color="#FFFFFF"
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.9}
                                style={styles.voiceReviewTrackWrap}
                                onLayout={(event) => {
                                    setVoiceDraftTrackWidth(event.nativeEvent.layout.width);
                                }}
                                onPress={(event) => {
                                    handleVoiceDraftTrackPress(event.nativeEvent.locationX);
                                }}
                            >
                                <View style={styles.voiceReviewTrack}>
                                    <View
                                        style={[
                                            styles.voiceReviewTrackFill,
                                            {
                                                width: voiceDraft.durationSeconds
                                                    ? `${Math.min(100, (voiceDraftPlaySeconds / voiceDraft.durationSeconds) * 100)}%`
                                                    : '0%',
                                            },
                                        ]}
                                    />
                                </View>
                                <Text style={styles.voiceReviewDuration}>
                                    {formatVoiceDuration(
                                        isPlayingVoiceDraft ? voiceDraftPlaySeconds : voiceDraft.durationSeconds,
                                    )}
                                </Text>
                            </TouchableOpacity>
                            {voiceDraft.canContinue ? (
                                <TouchableOpacity
                                    style={styles.voiceReviewRecordBtn}
                                    onPress={() => {
                                        void continueVoiceRecording();
                                    }}
                                >
                                    <Icon name="mic" size={ox(16)} color="#FDE68A" />
                                    <Text style={styles.voiceReviewRecordText}>Record</Text>
                                </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                                style={styles.sendButton}
                                onPress={() => {
                                    void sendVoiceDraft();
                                }}
                                accessibilityLabel="Send voice note"
                            >
                                <Icon name="send" size={ox(20)} color="#000000" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : null}
                {!ENABLE_VOICE_NOTES || !voiceDraft ? (
                <View
                    style={[
                        styles.inputContainer,
                        { paddingBottom: Math.max(insets.bottom, 6) },
                    ]}
                >
                    <View style={styles.inputRow}>
                        {ENABLE_VOICE_NOTES && isRecordingVoice ? (
                            <View style={styles.voiceActiveBar}>
                                <TouchableOpacity
                                    style={styles.voiceRecordingCancelBtn}
                                    onPress={() => {
                                        void cancelVoiceRecording();
                                    }}
                                    accessibilityLabel="Discard recording"
                                >
                                    <Icon name="trash-outline" size={ox(18)} color="#9CA3AF" />
                                </TouchableOpacity>
                                <View style={styles.voiceHoldCenter}>
                                    <View style={styles.voiceRecDot} />
                                    <Text style={styles.voiceHoldTimer}>
                                        {formatVoiceDuration(recordingSeconds)}
                                    </Text>
                                    <Text style={styles.voiceHoldHint}>
                                        {recordingGestureHint === 'cancel' ? 'Release to cancel' : 'Tap ■ to stop'}
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <>
                                <Avatar
                                    src={user?.avatarUrl}
                                    name={user?.name || user?.handle || 'You'}
                                    size={32}
                                />
                                <View style={styles.inputShell}>
                                    <TextInput
                                        ref={composerInputRef}
                                        value={messageText}
                                        onChangeText={setMessageText}
                                        placeholder={composerPlaceholder}
                                        placeholderTextColor="#8B98A5"
                                        style={styles.input}
                                        multiline
                                        maxLength={1000}
                                    />
                                </View>
                            </>
                        )}
                        {ENABLE_VOICE_NOTES ? (
                        <View
                            {...voiceMicPanResponder.panHandlers}
                            style={[
                                styles.composerMicButton,
                                isRecordingVoice && styles.composerMicButtonActive,
                            ]}
                            accessibilityLabel={isRecordingVoice ? 'Stop recording' : 'Record voice message'}
                        >
                            {isRecordingVoice ? (
                                <Icon name="square" size={ox(15)} color="#000000" />
                            ) : (
                                <LinearGradient
                                    colors={['#D1D5DB', '#EAB308', '#6B7280']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.composerMicGradient}
                                >
                                    <Icon name="mic" size={ox(17)} color="#FFFFFF" />
                                </LinearGradient>
                            )}
                        </View>
                        ) : null}
                        {messageText.trim() && !(ENABLE_VOICE_NOTES && isRecordingVoice) ? (
                            <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
                                <Icon name="send" size={ox(20)} color="#000000" />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
                ) : null}
                {showStickerPicker && (
                    <View style={styles.stickerPicker}>
                        {['❤️', '😂', '🔥', '👏', '😍', '👍', '🎉', '😮'].map((emoji) => (
                            <TouchableOpacity key={emoji} style={styles.stickerBtn} onPress={() => { void handleSendSticker(emoji); }}>
                                <Text style={styles.stickerBtnText}>{emoji}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={styles.stickerCloseBtn}
                            onPress={() => {
                                setStickerTargetMessageId(null);
                                setShowStickerPicker(false);
                            }}
                        >
                            <Text style={styles.stickerCloseBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>

            <View style={[styles.sheetOverlay, !createGroupOpen && styles.hidden]}>
                <View
                    style={[
                        styles.sheetCard,
                        { paddingBottom: Math.max(insets.bottom, 16) },
                    ]}
                >
                    <PassportSheetCanvas tone="ucl" contentStyle={styles.sheetCanvasInner}>
                        <Text style={styles.sheetTitle}>Create group</Text>
                        <Text style={styles.sheetLabel}>Group name</Text>
                        <TextInput
                            value={newGroupName}
                            onChangeText={setNewGroupName}
                            placeholder="e.g. Dublin creators"
                            placeholderTextColor={UCL_TEXT_PLACEHOLDER}
                            style={styles.sheetInput}
                            maxLength={80}
                        />
                        <Text style={styles.sheetLabel}>Group photo (optional)</Text>
                        <View style={styles.groupPhotoRow}>
                            <Avatar src={newGroupAvatarDataUrl} name={newGroupName || 'Group'} size={ox(42)} />
                            <TouchableOpacity style={styles.sheetSecondaryBtn} onPress={pickGroupAvatar}>
                                <Text style={styles.sheetSecondaryBtnText}>
                                    {newGroupAvatarDataUrl ? 'Change photo' : 'Choose photo'}
                                </Text>
                            </TouchableOpacity>
                            {!!newGroupAvatarDataUrl && (
                                <TouchableOpacity
                                    style={styles.sheetSecondaryBtn}
                                    onPress={() => setNewGroupAvatarDataUrl(undefined)}
                                >
                                    <Text style={styles.sheetSecondaryBtnText}>Remove</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <View style={styles.sheetActionsRow}>
                            <TouchableOpacity
                                style={styles.sheetSecondaryBtn}
                                onPress={() => {
                                    setCreateGroupOpen(false);
                                    setNewGroupName('');
                                    setNewGroupAvatarDataUrl(undefined);
                                }}
                            >
                                <Text style={styles.sheetSecondaryBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.sheetPrimaryBtn, creatingGroup && styles.sheetPrimaryBtnDisabled]}
                                onPress={handleCreateGroup}
                                disabled={creatingGroup}
                            >
                                <Text style={styles.sheetPrimaryBtnText}>
                                    {creatingGroup ? 'Creating...' : 'Create'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </PassportSheetCanvas>
                </View>
            </View>

            <View style={[styles.sheetOverlay, !(inviteOpen && isGroupAdmin) && styles.hidden]}>
                <View
                    style={[
                        styles.sheetCard,
                        { paddingBottom: Math.max(insets.bottom, 16) },
                    ]}
                >
                    <PassportSheetCanvas tone="ucl" contentStyle={styles.sheetCanvasInner}>
                        <Text style={styles.sheetTitle}>Invite member</Text>
                        <Text style={styles.sheetLabel}>Handle</Text>
                        <TextInput
                            value={inviteHandle}
                            onChangeText={setInviteHandle}
                            placeholder="@username"
                            placeholderTextColor={UCL_TEXT_PLACEHOLDER}
                            style={styles.sheetInput}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {inviteSearching ? (
                            <Text style={styles.suggestionsHint}>Searching...</Text>
                        ) : inviteSuggestions.length > 0 ? (
                            <View style={styles.suggestionsList}>
                                {inviteSuggestions.map((u) => (
                                    <TouchableOpacity
                                        key={u.handle}
                                        style={styles.suggestionRow}
                                        onPress={() => setInviteHandle(u.handle)}
                                    >
                                        <Avatar src={u.avatarUrl} name={u.handle} size={ox(28)} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.suggestionHandle}>{u.handle}</Text>
                                            {!!u.displayName && (
                                                <Text style={styles.suggestionName}>{u.displayName}</Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <Text style={styles.suggestionsHint}>
                                Type at least 2 characters to see suggestions.
                            </Text>
                        )}
                        <View style={styles.sheetActionsRow}>
                            <TouchableOpacity
                                style={styles.sheetSecondaryBtn}
                                onPress={() => {
                                    setInviteOpen(false);
                                    setInviteHandle('');
                                    setInviteSuggestions([]);
                                }}
                            >
                                <Text style={styles.sheetSecondaryBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.sheetPrimaryBtn, inviteBusy && styles.sheetPrimaryBtnDisabled]}
                                onPress={handleInviteMember}
                                disabled={inviteBusy}
                            >
                                <Text style={styles.sheetPrimaryBtnText}>
                                    {inviteBusy ? 'Sending...' : 'Send invite'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </PassportSheetCanvas>
                </View>
            </View>

            <View style={[styles.sheetOverlay, !showChatInfo && styles.hidden]}>
                <TouchableOpacity
                    style={styles.sheetBackdropTap}
                    activeOpacity={1}
                    onPress={() => setShowChatInfo(false)}
                />
                <View
                    style={[
                        styles.chatInfoSheet,
                        { paddingBottom: Math.max(insets.bottom, 16) },
                    ]}
                >
                    <PassportSheetCanvas tone="ucl" style={styles.chatInfoCanvas}>
                        <View style={styles.chatInfoHeader}>
                            <Text style={styles.chatInfoTitle}>Chat Info</Text>
                            <TouchableOpacity onPress={() => setShowChatInfo(false)}>
                                <Icon name="close" size={ox(24)} color={UCL_TEXT_PRIMARY} />
                            </TouchableOpacity>
                        </View>
                        {isGroupThread ? (
                            <ScrollView
                                style={styles.chatInfoBody}
                                contentContainerStyle={styles.chatInfoBodyContent}
                                bounces={false}
                            >
                                <View style={styles.chatInfoProfileRow}>
                                    <Avatar
                                        src={groupAvatarUrl}
                                        name={groupName || 'Group'}
                                        size={ox(56)}
                                    />
                                    <View style={styles.chatInfoProfileText}>
                                        <Text style={styles.chatInfoName}>{groupName}</Text>
                                        <Text style={styles.chatInfoSubtitle}>Group chat</Text>
                                    </View>
                                </View>
                                <Text style={styles.chatInfoHint}>
                                    {isGroupAdmin
                                        ? "To add people, use the + button in the chat header, or open someone's profile and choose Invite to group."
                                        : 'Only the group admin can invite people to this chat.'}
                                </Text>
                                <TouchableOpacity
                                    style={styles.leaveGroupBtn}
                                    onPress={confirmLeaveGroup}
                                    disabled={leaveGroupBusy}
                                >
                                    {leaveGroupBusy ? (
                                        <ActivityIndicator color="#EF4444" />
                                    ) : (
                                        <>
                                            <Icon name="close-circle-outline" size={ox(20)} color="#EF4444" />
                                            <Text style={styles.leaveGroupBtnText}>Leave Group</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        ) : (
                            <ScrollView
                                style={styles.chatInfoBody}
                                contentContainerStyle={styles.chatInfoBodyContent}
                                bounces={false}
                            >
                                <View style={styles.chatInfoProfileRow}>
                                    <Avatar
                                        src={getAvatarForHandle(handle)}
                                        name={handle?.split('@')[0] || 'User'}
                                        size={ox(56)}
                                    />
                                    <View style={styles.chatInfoProfileText}>
                                        <Text style={styles.chatInfoName}>{handle}</Text>
                                        <Text style={styles.chatInfoSubtitle}>Active now</Text>
                                    </View>
                                </View>

                                <Text style={styles.dmBubbleLabel}>Your sent messages</Text>
                                <Text style={styles.dmBubbleHint}>
                                    Passport colours from View Profile (saved on this device).
                                </Text>
                                <View style={styles.dmBubbleToggle}>
                                    <TouchableOpacity
                                        style={[
                                            styles.dmBubbleOption,
                                            dmSentStyle === 'blue' && styles.dmBubbleOptionBlue,
                                        ]}
                                        onPress={() => {
                                            void handleToggleDmBubbleStyle('blue');
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.dmBubbleOptionText,
                                                dmSentStyle === 'blue' && styles.dmBubbleOptionTextActive,
                                            ]}
                                        >
                                            Sea glass
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.dmBubbleOption,
                                            dmSentStyle === 'green' && styles.dmBubbleOptionGreen,
                                        ]}
                                        onPress={() => {
                                            void handleToggleDmBubbleStyle('green');
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.dmBubbleOptionText,
                                                dmSentStyle === 'green' && styles.dmBubbleOptionTextActive,
                                            ]}
                                        >
                                            Brass
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    style={styles.chatInfoActionRow}
                                    onPress={() => {
                                        if (!handle) return;
                                        setShowChatInfo(false);
                                        navigation.navigate('ViewProfile', { handle });
                                    }}
                                >
                                    <Icon name="person-outline" size={ox(20)} color="#FFFFFF" />
                                    <Text style={styles.chatInfoActionText}>View Profile</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.chatInfoActionRow}
                                    onPress={() => {
                                        void handleToggleMuteFromSheet();
                                    }}
                                >
                                    <Icon name="mic-outline" size={ox(20)} color="#FFFFFF" />
                                    <Text style={styles.chatInfoActionText}>
                                        {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.chatInfoActionRow} onPress={confirmBlockUser}>
                                    <Icon name="alert-circle-outline" size={ox(20)} color="#EF4444" />
                                    <Text style={styles.chatInfoActionDangerText}>
                                        {isBlocked ? 'Unblock User' : 'Block User'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.chatInfoActionRow}
                                    onPress={confirmDeleteConversation}
                                >
                                    <Icon name="close-circle-outline" size={ox(20)} color="#EF4444" />
                                    <Text style={styles.chatInfoActionDangerText}>Delete Conversation</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </PassportSheetCanvas>
                </View>
            </View>

            <GazetteerAlertSheet
                visible={sheetAlert != null}
                title={sheetAlert?.title ?? ''}
                message={sheetAlert?.message}
                icon={sheetAlert?.icon ?? 'alert'}
                confirmButtonText={sheetAlert?.confirmButtonText ?? 'OK'}
                showCancelButton={sheetAlert?.showCancelButton}
                cancelButtonText={sheetAlert?.cancelButtonText}
                onConfirm={() => {
                    const action = sheetAlert?.onConfirm;
                    setSheetAlert(null);
                    action?.();
                }}
                onDismiss={() => setSheetAlert(null)}
            />
            <DmMessageActionsSheet
                visible={messageActionsTarget != null}
                timestampLabel={
                    messageActionsTarget
                        ? formatMessageClock(messageActionsTarget.timestamp)
                        : undefined
                }
                onReact={(emoji) => {
                    if (messageActionsTarget) {
                        handleReactWithAnimation(messageActionsTarget.id, emoji);
                    }
                }}
                actions={messageActionsTarget ? messageActionList(messageActionsTarget) : []}
                onDismiss={closeMessageActions}
            />
            {reactionFly ? (
                <DmReactionFlyOverlay
                    emoji={reactionFly.emoji}
                    target={reactionFly.target}
                    onPopComplete={measureReactionFlyTarget}
                    onComplete={() => setReactionFly(null)}
                />
            ) : null}
            <GazetteerMenuSheet
                visible={sheetMenu != null}
                title={sheetMenu?.title ?? ''}
                subtitle={sheetMenu?.subtitle}
                options={sheetMenu?.options ?? []}
                onDismiss={() => setSheetMenu(null)}
            />
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    pageShell: {
        backgroundColor: '#000000',
    },
    threadLoadingWrap: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: ox(48),
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ox(12),
        paddingVertical: ox(10),
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.12)',
    },
    headerBackBtn: {
        width: ox(36),
        height: ox(36),
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(10),
        flex: 1,
        marginLeft: ox(4),
        minWidth: 0,
    },
    headerAvatarWrap: {
        position: 'relative',
        width: ox(36),
        height: ox(36),
    },
    followBadge: {
        position: 'absolute',
        right: -ox(2),
        bottom: -ox(2),
        width: ox(18),
        height: ox(18),
        borderRadius: ox(9),
        borderWidth: 2,
        borderColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    followBadgeCheck: {
        backgroundColor: '#22C55E',
    },
    headerTextCol: {
        flex: 1,
        minWidth: 0,
    },
    headerName: {
        fontSize: ox(16),
        fontWeight: '600',
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: ox(12),
        color: '#9CA3AF',
        marginTop: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(4),
    },
    headerActionButton: {
        width: ox(36),
        height: ox(36),
        borderRadius: ox(18),
        alignItems: 'center',
        justifyContent: 'center',
    },
    keyboardView: {
        flex: 1,
    },
    messagesList: {
        flex: 1,
    },
    messagesContent: {
        flexGrow: 1,
        justifyContent: 'flex-end',
        paddingHorizontal: ox(12),
        paddingTop: ox(10),
        paddingBottom: ox(12),
    },
    messagesContentEmpty: {
        justifyContent: 'center',
    },
    loadingOlderWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ox(8),
        paddingVertical: ox(8),
    },
    loadingOlderText: {
        color: '#9CA3AF',
        fontSize: ox(12),
    },
    messageContainer: {
        width: '100%',
        alignSelf: 'stretch',
        flexDirection: 'row',
        marginBottom: ox(6),
        alignItems: 'flex-end',
        gap: ox(8),
        paddingHorizontal: ox(4),
    },
    messageFromMe: {
        justifyContent: 'flex-end',
    },
    messageFromOther: {
        justifyContent: 'flex-start',
    },
    messageColumn: {
        flexShrink: 1,
        minWidth: 0,
        maxWidth: '78%',
    },
    messageColumnMe: {
        alignItems: 'flex-end',
    },
    messageColumnOther: {
        alignItems: 'flex-start',
        flexGrow: 1,
        flexShrink: 1,
    },
    sharedPostColumn: {
        maxWidth: '88%',
    },
    sharedPostCaption: {
        marginTop: ox(6),
        paddingHorizontal: ox(10),
        paddingVertical: ox(7),
        borderRadius: ox(14),
        backgroundColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    messageMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(4),
        paddingTop: ox(4),
        paddingHorizontal: ox(2),
    },
    messageMetaRowMe: {
        justifyContent: 'flex-end',
    },
    messageMetaRowOther: {
        justifyContent: 'flex-start',
    },
    messageTimeOutside: {
        fontSize: ox(10),
        color: '#8E8E93',
    },
    messageTextPlain: {
        fontSize: ox(15),
        lineHeight: ox(20),
        color: '#FFFFFF',
    },
    messageText: {
        fontSize: ox(15),
        lineHeight: ox(21),
        flexShrink: 1,
    },
    messageTextFromMe: {
        color: '#FFFFFF',
    },
    messageTextFromOther: {
        color: '#F9FAFB',
    },
    messageImage: {
        width: DM_MEDIA_MAX_WIDTH,
        maxWidth: '100%',
        aspectRatio: DM_MEDIA_ASPECT_RATIO,
        borderRadius: ox(12),
        marginTop: ox(8),
    },
    messageVideoFallback: {
        width: 200,
        height: 120,
        borderRadius: ox(12),
        marginTop: ox(8),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.24)',
        backgroundColor: '#111827',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ox(8),
    },
    messageVideoFallbackText: {
        color: '#E5E7EB',
        fontSize: ox(13),
        fontWeight: '700',
    },
    audioMessagePill: {
        marginTop: ox(8),
        borderRadius: ox(999),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.24)',
        backgroundColor: 'rgba(0,0,0,0.25)',
        paddingHorizontal: ox(10),
        paddingVertical: ox(6),
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: ox(6),
    },
    audioMessageText: {
        color: '#F3F4F6',
        fontSize: ox(12),
        fontWeight: '700',
    },
    messageTime: {
        fontSize: ox(10),
        marginTop: ox(3),
    },
    messageTimeFromMe: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
    messageTimeFromOther: {
        color: '#9CA3AF',
    },
    storyContextWrap: {
        alignItems: 'center',
        marginBottom: ox(12),
    },
    storyContextCard: {
        maxWidth: '86%',
        borderRadius: ox(14),
        borderWidth: 1,
        borderColor: 'rgba(103, 232, 249, 0.3)',
        backgroundColor: 'rgba(6, 182, 212, 0.12)',
        paddingHorizontal: ox(12),
        paddingVertical: ox(8),
    },
    storyContextLabel: {
        fontSize: ox(10),
        color: '#A5F3FC',
        textTransform: 'uppercase',
        letterSpacing: ox(0.8),
        fontWeight: '700',
        marginBottom: ox(4),
    },
    storyContextText: {
        fontSize: ox(13),
        color: '#F9FAFB',
        lineHeight: ox(18),
    },
    storyStickerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(10),
        width: ox(260),
        maxWidth: '100%',
        backgroundColor: '#111827',
        borderRadius: ox(16),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        padding: ox(8),
        marginVertical: ox(4),
    },
    storyStickerCardMine: {
        backgroundColor: '#0f172a',
        borderColor: 'rgba(96,165,250,0.35)',
    },
    storyStickerThumb: {
        width: ox(56),
        height: ox(72),
        borderRadius: ox(10),
        backgroundColor: '#1F2937',
    },
    storyStickerThumbFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    storyStickerMeta: {
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
        paddingRight: ox(4),
    },
    storyStickerLabel: {
        color: '#93C5FD',
        fontSize: ox(12),
        fontWeight: '700',
        marginBottom: ox(2),
    },
    storyStickerBody: {
        color: '#F9FAFB',
        fontSize: ox(15),
        fontWeight: '600',
        lineHeight: ox(20),
    },
    storyStickerHint: {
        color: '#6B7280',
        fontSize: ox(11),
        marginTop: ox(4),
    },
    inputContainer: {
        paddingHorizontal: 14,
        paddingTop: 6,
        paddingBottom: 0,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(12,15,20,0.92)',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    composerContextWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(10),
        paddingHorizontal: ox(16),
        paddingTop: ox(10),
        paddingBottom: ox(8),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: '#000000',
    },
    composerEditingBody: {
        flex: 1,
        minWidth: 0,
    },
    composerContextTitle: {
        color: '#737373',
        fontSize: ox(11),
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 1,
    },
    composerContextText: {
        color: '#E5E7EB',
        fontSize: ox(13),
    },
    inputShell: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        paddingLeft: 14,
        paddingRight: 14,
        minHeight: 40,
    },
    input: {
        flex: 1,
        minWidth: 0,
        minHeight: 40,
        paddingVertical: 10,
        paddingHorizontal: 0,
        margin: 0,
        backgroundColor: 'transparent',
        borderWidth: 0,
        color: '#FFFFFF',
        fontSize: 15,
        maxHeight: 100,
    },
    composerMicButton: {
        width: ox(40),
        height: ox(40),
        borderRadius: ox(20),
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#FDE047',
    },
    composerMicGradient: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    composerMicButtonActive: {
        backgroundColor: '#EAB308',
        borderColor: '#FFFFFF',
    },
    recordingBadge: {
        borderRadius: ox(999),
        borderWidth: 1,
        borderColor: '#D4AF37',
        backgroundColor: 'rgba(212,175,55,0.15)',
        paddingHorizontal: ox(8),
        paddingVertical: ox(6),
    },
    recordingBadgeText: {
        color: '#FDE68A',
        fontSize: ox(11),
        fontWeight: '700',
    },
    sendButton: {
        width: ox(40),
        height: ox(40),
        borderRadius: ox(20),
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#1F2937',
    },
    sendButtonRecording: {
        backgroundColor: '#D4AF37',
    },
    recordingHintWrap: {
        marginHorizontal: ox(16),
        marginBottom: ox(6),
    },
    recordingHintText: {
        color: '#D4AF37',
        fontSize: ox(12),
        fontWeight: '700',
    },
    recordingHintSubtleText: {
        color: '#6B7280',
        fontSize: ox(11),
        fontWeight: '600',
        marginTop: ox(6),
        marginHorizontal: ox(4),
        textAlign: 'center',
    },
    voiceReviewSection: {
        marginHorizontal: ox(16),
        marginTop: ox(8),
        marginBottom: ox(4),
    },
    voiceReviewLabel: {
        color: '#9CA3AF',
        fontSize: ox(11),
        fontWeight: '600',
        marginBottom: ox(8),
        marginLeft: 2,
    },
    voiceReviewBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
        paddingVertical: ox(8),
        paddingHorizontal: ox(10),
        borderRadius: ox(24),
        borderWidth: 2,
        borderColor: '#FFFFFF',
        backgroundColor: '#09090b',
    },
    voiceReviewIconBtn: {
        width: ox(36),
        height: ox(36),
        borderRadius: ox(18),
        alignItems: 'center',
        justifyContent: 'center',
    },
    voiceReviewPlayBtn: {
        width: ox(36),
        height: ox(36),
        borderRadius: ox(18),
        backgroundColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center',
    },
    voiceReviewTrackWrap: {
        flex: 1,
        minWidth: 0,
        gap: ox(4),
    },
    voiceReviewTrack: {
        height: 4,
        borderRadius: ox(999),
        backgroundColor: '#374151',
        overflow: 'hidden',
    },
    voiceReviewTrackFill: {
        height: '100%',
        borderRadius: ox(999),
        backgroundColor: '#D4AF37',
    },
    voiceReviewDuration: {
        color: '#9CA3AF',
        fontSize: ox(11),
        fontWeight: '600',
        textAlign: 'right',
    },
    voiceReviewRecordBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(4),
        borderRadius: ox(999),
        borderWidth: 1,
        borderColor: '#92400E',
        backgroundColor: 'rgba(180,83,9,0.2)',
        paddingHorizontal: ox(10),
        paddingVertical: ox(7),
    },
    voiceReviewRecordText: {
        color: '#FDE68A',
        fontSize: ox(12),
        fontWeight: '700',
    },
    voiceActiveBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: ox(44),
        paddingHorizontal: ox(10),
        borderRadius: ox(24),
        borderWidth: 2,
        borderColor: '#FFFFFF',
        backgroundColor: '#09090b',
        gap: ox(10),
    },
    voiceHoldCenter: {
        alignItems: 'center',
        flex: 1,
    },
    voiceHoldTimer: {
        color: '#FFFFFF',
        fontSize: ox(15),
        fontWeight: '800',
    },
    voiceHoldHint: {
        color: '#D4AF37',
        fontSize: ox(11),
        fontWeight: '700',
        marginTop: ox(2),
    },
    voiceRecDot: {
        width: 8,
        height: 8,
        borderRadius: ox(4),
        backgroundColor: '#D4AF37',
    },
    voiceRecordingCancelBtn: {
        width: ox(40),
        height: ox(40),
        borderRadius: ox(20),
        borderWidth: 1,
        borderColor: '#4B5563',
        backgroundColor: 'rgba(75,85,99,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    readReceiptWrap: {
        alignSelf: 'flex-end',
        marginTop: ox(2),
    },
    quotedReply: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'stretch',
        borderRadius: ox(10),
        backgroundColor: 'rgba(0,0,0,0.30)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.14)',
        paddingVertical: ox(6),
        paddingLeft: ox(12),
        paddingRight: ox(8),
        overflow: 'hidden',
    },
    quotedReplyBubble: {
        marginBottom: ox(6),
    },
    quotedReplyComposer: {
        flex: 1,
        minWidth: 0,
        paddingVertical: ox(8),
    },
    quotedReplyAccent: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: 'rgba(255,255,255,0.55)',
    },
    quotedReplyThumb: {
        width: ox(34),
        height: ox(34),
        borderRadius: ox(6),
        overflow: 'hidden',
        backgroundColor: '#000000',
        marginRight: ox(8),
    },
    quotedReplyThumbComposer: {
        width: ox(44),
        height: ox(44),
        borderRadius: ox(8),
    },
    quotedReplyThumbImage: {
        width: '100%',
        height: '100%',
    },
    quotedReplyVideoBadge: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111827',
    },
    quotedReplyVideoBadgeOverlay: {
        position: 'absolute',
        right: ox(2),
        bottom: ox(2),
        width: ox(16),
        height: ox(16),
        borderRadius: ox(8),
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quotedReplyBody: {
        flex: 1,
        minWidth: 0,
    },
    quotedReplySender: {
        color: 'rgba(255,255,255,0.88)',
        fontSize: ox(11),
        fontWeight: '700',
        marginBottom: ox(1),
    },
    quotedReplyText: {
        color: 'rgba(255,255,255,0.62)',
        fontSize: ox(12),
    },
    swipeReplyCue: {
        width: ox(22),
        height: ox(22),
        borderRadius: ox(11),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    reactionsRow: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ox(4),
    },
    reactionPill: {
        borderRadius: ox(999),
        paddingHorizontal: ox(7),
        paddingVertical: ox(3),
        backgroundColor: 'rgba(255,255,255,0.92)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(4),
    },
    reactionEmoji: {
        fontSize: ox(12),
    },
    reactionCount: {
        color: '#374151',
        fontSize: ox(10),
        fontWeight: '700',
    },
    translatedOriginalText: {
        marginTop: ox(4),
        fontSize: ox(11),
        lineHeight: ox(15),
        color: 'rgba(255,255,255,0.6)',
        fontStyle: 'italic',
    },
    stickerPicker: {
        marginHorizontal: ox(16),
        marginBottom: ox(8),
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        padding: ox(10),
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ox(8),
        alignItems: 'center',
    },
    stickerBtn: {
        width: ox(36),
        height: ox(36),
        borderRadius: ox(18),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1F2937',
    },
    stickerBtnText: {
        fontSize: ox(18),
    },
    stickerCloseBtn: {
        marginLeft: 'auto',
        borderRadius: ox(8),
        borderWidth: 1,
        borderColor: '#4B5563',
        paddingHorizontal: ox(10),
        paddingVertical: ox(6),
    },
    stickerCloseBtnText: {
        color: '#E5E7EB',
        fontSize: ox(12),
        fontWeight: '700',
    },
    hidden: {
        display: 'none',
    },
    sheetOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
        zIndex: 20,
    },
    sheetBackdropTap: {
        flex: 1,
        width: '100%',
    },
    chatInfoSheet: {
        backgroundColor: UCL_CANVAS_NAVY,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.1)',
        maxHeight: '80%',
        overflow: 'hidden',
        width: '100%',
    },
    chatInfoCanvas: {
        width: '100%',
    },
    chatInfoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ox(16),
        paddingVertical: ox(12),
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.12)',
    },
    chatInfoTitle: {
        color: UCL_TEXT_PRIMARY,
        fontSize: ox(16),
        fontWeight: '600',
    },
    chatInfoBody: {
        maxHeight: 480,
    },
    chatInfoBodyContent: {
        padding: ox(16),
        paddingBottom: ox(28),
    },
    chatInfoProfileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(16),
        marginBottom: ox(20),
    },
    chatInfoProfileText: {
        flex: 1,
        minWidth: 0,
    },
    chatInfoName: {
        color: UCL_TEXT_PRIMARY,
        fontSize: ox(18),
        fontWeight: '600',
    },
    chatInfoSubtitle: {
        color: '#E2E8F0',
        fontSize: ox(14),
        marginTop: ox(2),
    },
    chatInfoHint: {
        color: UCL_TEXT_PLACEHOLDER,
        fontSize: ox(12),
        lineHeight: ox(18),
        marginBottom: ox(16),
    },
    leaveGroupBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(12),
        paddingHorizontal: ox(16),
        paddingVertical: ox(14),
        borderRadius: ox(12),
    },
    leaveGroupBtnText: {
        color: '#EF4444',
        fontSize: ox(16),
        fontWeight: '600',
    },
    dmBubbleLabel: {
        color: UCL_TEXT_PLACEHOLDER,
        fontSize: ox(12),
        marginBottom: ox(4),
    },
    dmBubbleHint: {
        color: UCL_TEXT_PLACEHOLDER,
        fontSize: ox(11),
        marginBottom: ox(8),
    },
    dmBubbleToggle: {
        flexDirection: 'row',
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 2,
        marginBottom: ox(16),
    },
    dmBubbleOption: {
        flex: 1,
        paddingVertical: ox(10),
        borderRadius: ox(10),
        alignItems: 'center',
        justifyContent: 'center',
    },
    dmBubbleOptionBlue: {
        backgroundColor: DM_SENT_PASSPORT,
    },
    dmBubbleOptionGreen: {
        backgroundColor: DM_SENT_BRASS,
    },
    dmBubbleOptionText: {
        color: '#9CA3AF',
        fontSize: ox(14),
        fontWeight: '600',
    },
    dmBubbleOptionTextActive: {
        color: '#FFFFFF',
    },
    chatInfoActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(12),
        paddingHorizontal: ox(16),
        paddingVertical: ox(14),
        borderRadius: ox(12),
    },
    chatInfoActionText: {
        color: '#FFFFFF',
        fontSize: ox(16),
        fontWeight: '500',
    },
    chatInfoActionDangerText: {
        color: '#EF4444',
        fontSize: ox(16),
        fontWeight: '500',
    },
    sheetCard: {
        backgroundColor: UCL_CANVAS_NAVY,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    sheetCanvasInner: {
        padding: ox(16),
    },
    sheetTitle: {
        color: UCL_TEXT_PRIMARY,
        fontSize: ox(18),
        fontWeight: '600',
        marginBottom: ox(12),
    },
    sheetLabel: {
        color: '#E2E8F0',
        fontSize: ox(13),
        marginBottom: ox(6),
    },
    sheetInput: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: ox(10),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        color: UCL_TEXT_PRIMARY,
        paddingHorizontal: ox(12),
        paddingVertical: ox(10),
        fontSize: ox(14),
        marginBottom: ox(12),
    },
    groupPhotoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
        marginBottom: ox(14),
    },
    sheetActionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: ox(8),
    },
    sheetSecondaryBtn: {
        borderRadius: ox(8),
        borderWidth: 1,
        borderColor: '#FFFFFF',
        paddingHorizontal: ox(12),
        paddingVertical: ox(8),
    },
    sheetSecondaryBtnText: {
        color: '#FFFFFF',
        fontSize: ox(13),
        fontWeight: '600',
    },
    sheetPrimaryBtn: {
        borderRadius: ox(8),
        backgroundColor: '#FFFFFF',
        paddingHorizontal: ox(14),
        paddingVertical: ox(8),
    },
    sheetPrimaryBtnDisabled: {
        opacity: 0.6,
    },
    sheetPrimaryBtnText: {
        color: '#030712',
        fontSize: ox(13),
        fontWeight: '700',
    },
    suggestionsList: {
        marginBottom: ox(12),
        backgroundColor: '#111827',
        borderRadius: ox(10),
        borderWidth: 1,
        borderColor: '#374151',
        overflow: 'hidden',
    },
    suggestionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(10),
        paddingHorizontal: ox(10),
        paddingVertical: ox(8),
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    suggestionHandle: {
        color: '#FFFFFF',
        fontSize: ox(13),
        fontWeight: '600',
    },
    suggestionName: {
        color: '#E2E8F0',
        fontSize: ox(12),
    },
    suggestionsHint: {
        color: UCL_TEXT_PLACEHOLDER,
        fontSize: ox(12),
        marginBottom: ox(12),
    },
    imageComposeWrap: {
        flexDirection: 'row',
        gap: ox(10),
        marginHorizontal: ox(16),
        marginTop: ox(8),
        padding: ox(10),
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
    },
    imageComposePreview: {
        width: ox(64),
        height: ox(64),
        borderRadius: ox(10),
    },
    imageComposeBody: {
        flex: 1,
    },
    imageComposeTitle: {
        color: '#E5E7EB',
        fontSize: ox(12),
        fontWeight: '700',
        marginBottom: ox(6),
    },
    imageComposeInput: {
        borderRadius: ox(10),
        borderWidth: 1,
        borderColor: '#4B5563',
        backgroundColor: '#0F172A',
        color: '#FFFFFF',
        paddingHorizontal: ox(10),
        paddingVertical: ox(8),
        fontSize: ox(13),
    },
    imageComposeActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: ox(8),
        marginTop: ox(8),
    },
    imageComposeCancelBtn: {
        borderRadius: ox(8),
        borderWidth: 1,
        borderColor: '#4B5563',
        backgroundColor: '#1F2937',
        paddingHorizontal: ox(10),
        paddingVertical: ox(6),
    },
    imageComposeCancelText: {
        color: '#D1D5DB',
        fontSize: ox(12),
        fontWeight: '700',
    },
    imageComposeSendBtn: {
        borderRadius: ox(8),
        backgroundColor: '#3B82F6',
        paddingHorizontal: ox(12),
        paddingVertical: ox(6),
    },
    imageComposeSendText: {
        color: '#FFFFFF',
        fontSize: ox(12),
        fontWeight: '700',
    },
});













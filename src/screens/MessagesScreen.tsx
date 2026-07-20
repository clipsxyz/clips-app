import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import { glassPanel, glassSurface, gazetteerHeader } from '../theme/gazetteerAmbientNative';
import { navigateMainTab } from '../navigation/mainTabs';
import { launchImageLibrary } from 'react-native-image-picker';
import Clipboard from '@react-native-clipboard/clipboard';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { useAuth } from '../context/Auth';
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
    type ChatMessage,
} from '../api/messages';
import { createChatGroup, inviteUserToChatGroup, leaveChatGroup } from '../api/chatGroups';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { uploadFileFromUri } from '../utils/uploadFileNative';
import { getAvatarForHandle } from '../api/users';
import { unifiedSearch } from '../api/search';
import { timeAgo } from '../utils/timeAgo';
import Avatar from '../components/Avatar';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet.native';
import GazetteerMenuSheet, { type GazetteerMenuOption } from '../components/GazetteerMenuSheet.native';
import IMessageDmBubbleShell from '../components/IMessageDmBubbleShell.native';
import {
    DM_RECEIVED,
    dmSentBubbleColor,
    getDmSentBubblePreference,
    type DmSentBubbleStyle,
} from '../constants/dmImessageTheme.native';
import { toFileUri } from '../utils/ffmpegNative';

type VoiceDraftSegment = { audioUrl: string; durationSeconds: number };
type VoiceDraftState = {
    audioUrl: string;
    durationSeconds: number;
    segments: VoiceDraftSegment[];
    canContinue?: boolean;
};

const DEBUG_MESSAGE_PAGING =
    __DEV__ && (globalThis as { __CLIPS_DEBUG_MESSAGE_PAGING__?: boolean }).__CLIPS_DEBUG_MESSAGE_PAGING__ === true;

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
    const initialGroupName =
        (typeof routeGroupName === 'string' && routeGroupName.trim()) ||
        (typeof communityCreatedName === 'string' && communityCreatedName.trim()) ||
        'Group';
    const [groupName, setGroupName] = useState(initialGroupName);
    const [groupAvatarUrl, setGroupAvatarUrl] = useState<string | undefined>(undefined);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageText, setMessageText] = useState('');
    const [loading, setLoading] = useState(true);
    const [threadCursor, setThreadCursor] = useState<string | null>(null);
    const [threadHasMore, setThreadHasMore] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupAvatarDataUrl, setNewGroupAvatarDataUrl] = useState<string | undefined>(undefined);
    const [creatingGroup, setCreatingGroup] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteHandle, setInviteHandle] = useState('');
    const [inviteBusy, setInviteBusy] = useState(false);
    const [inviteSuggestions, setInviteSuggestions] = useState<Array<{ handle: string; displayName?: string; avatarUrl?: string }>>([]);
    const [inviteSearching, setInviteSearching] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
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

    useEffect(() => {
        void getDmSentBubblePreference().then(setDmSentStyle);
    }, []);
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const [sheetAlert, setSheetAlert] = useState<SheetAlertState | null>(null);
    const [sheetMenu, setSheetMenu] = useState<SheetMenuState | null>(null);
    const [showChatInfo, setShowChatInfo] = useState(false);
    const [leaveGroupBusy, setLeaveGroupBusy] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const shouldAutoScrollRef = useRef(true);
    const [swipingMessageId, setSwipingMessageId] = useState<string | null>(null);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const swipeStartRef = useRef<{ x: number; y: number; message: ChatMessage | null } | null>(null);
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
        loadMessages(true);
    }, [handle, chatGroupId]);

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
        syncMuted();
        return () => {
            cancelled = true;
        };
    }, [user?.handle, handle, isGroupThread]);

    useEffect(() => {
        if (loading || messages.length === 0) return;
        scrollMessagesToBottom(false);
    }, [loading, messages.length, scrollMessagesToBottom]);

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
            setMessages(page.items);
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
                setMessages((prev) => {
                    const seen = new Set(prev.map((m) => m.id));
                    const merged = [...page.items.filter((m) => !seen.has(m.id)), ...prev];
                    return merged.sort((a, b) => a.timestamp - b.timestamp);
                });
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

        const replyToPayload = replyingTo
            ? {
                messageId: replyingTo.id,
                text: replyingTo.text || '',
                senderHandle: replyingTo.senderHandle,
                imageUrl: replyingTo.imageUrl,
                mediaType: (isLikelyVideoUrl(replyingTo.imageUrl) ? 'video' : 'image') as 'image' | 'video',
            }
            : undefined;

        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            senderHandle: user.handle,
            text: draftText,
            timestamp: Date.now(),
            replyTo: replyToPayload,
        };

        shouldAutoScrollRef.current = true;
        setMessages(prev => [...prev, newMessage]);
        setMessageText('');
        scrollMessagesToBottom(true);

        try {
            if (isGroupThread && chatGroupId) {
                await appendGroupChatMessage(user.handle, chatGroupId, { text: newMessage.text, replyTo: replyToPayload });
            } else {
                await appendMessage(user.handle, handle, { text: newMessage.text, replyTo: replyToPayload });
            }
            await loadMessages(true); // Reload latest page to get server ids/timestamps
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setReplyingTo(null);
        }
    };

    const openMessageActions = (item: ChatMessage) => {
        const fromMe = item.senderHandle === user?.handle;
        const options: GazetteerMenuOption[] = [
            { label: 'React ❤️', onPress: () => handleToggleReaction(item.id, '❤️') },
            { label: 'React 😂', onPress: () => handleToggleReaction(item.id, '😂') },
            { label: 'React 🔥', onPress: () => handleToggleReaction(item.id, '🔥') },
            {
                label: 'Reply',
                onPress: () => {
                    setReplyingTo(item);
                    setEditingMessage(null);
                },
            },
        ];
        if (item.storyId) {
            options.push({
                label: 'View story',
                onPress: () => {
                    navigation.navigate('Stories', {
                        openUserHandle: item.senderHandle || handle,
                        openStoryId: item.storyId,
                    });
                },
            });
        }
        if (fromMe && !isGroupThread) {
            options.push({
                label: 'Edit',
                onPress: () => {
                    setEditingMessage(item);
                    setReplyingTo(null);
                    setMessageText(item.text || '');
                },
            });
        }
        if (!fromMe) {
            options.push({
                label: 'View profile',
                onPress: () => {
                    navigation.navigate('ViewProfile', { handle: item.senderHandle });
                },
            });
        }
        if (item.text) {
            options.push({
                label: 'Copy text',
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
            options.push({
                label: translatedMessages[item.id] ? 'Hide translation' : 'Translate',
                onPress: () => {
                    void handleTranslateMessage(item);
                },
            });
        }
        options.push(
            {
                label: 'Add sticker',
                onPress: () => {
                    setStickerTargetMessageId(item.id);
                    setShowStickerPicker(true);
                },
            },
            {
                label: 'Forward',
                onPress: () => {
                    void handleForwardMessage(item);
                },
            },
            {
                label: 'Report',
                onPress: () => {
                    handleReportMessage(item);
                },
                destructive: true,
            },
        );
        showMenu({
            title: 'Message actions',
            subtitle: 'Choose an action',
            options,
        });
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
            await inviteUserToChatGroup(chatGroupId, normalized);
            setInviteOpen(false);
            setInviteHandle('');
            setInviteSuggestions([]);
            showAlert({
                title: 'Invite sent',
                message: `@${normalized} will see this invite in notifications.`,
                icon: 'success',
                confirmButtonText: 'OK',
            });
        } catch (error) {
            console.error('Invite failed:', error);
            showAlert({
                title: 'Invite failed',
                message: 'Could not send invite right now.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
        } finally {
            setInviteBusy(false);
        }
    };

    const openHeaderActions = () => {
        if (isGroupThread) {
            setShowChatInfo(true);
            return;
        }
        const toggleMuteAction: GazetteerMenuOption = isMuted
            ? {
                label: 'Unmute conversation',
                onPress: () => {
                    void (async () => {
                        if (!user?.handle || !handle) return;
                        try {
                            await unmuteConversation(user.handle, handle);
                            setIsMuted(false);
                        } catch {
                            showAlert({
                                title: 'Action failed',
                                message: 'Could not update mute state right now.',
                                icon: 'alert',
                                confirmButtonText: 'OK',
                            });
                        }
                    })();
                },
            }
            : {
                label: 'Mute conversation',
                onPress: () => {
                    void (async () => {
                        if (!user?.handle || !handle) return;
                        try {
                            await muteConversation(user.handle, handle);
                            setIsMuted(true);
                        } catch {
                            showAlert({
                                title: 'Action failed',
                                message: 'Could not update mute state right now.',
                                icon: 'alert',
                                confirmButtonText: 'OK',
                            });
                        }
                    })();
                },
            };
        showMenu({
            title: 'Chat actions',
            subtitle: 'Choose an action',
            options: [
                { label: 'Create group', onPress: () => setCreateGroupOpen(true) },
                toggleMuteAction,
            ],
        });
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
        const optimistic: ChatMessage = {
            id: `${Date.now()}-img`,
            senderHandle: user.handle,
            imageUrl: imageCompose.imageUrl,
            text: trimmedCaption || undefined,
            timestamp: Date.now(),
        };
        setImageCompose(null);
        shouldAutoScrollRef.current = true;
        setMessages((prev) => [...prev, optimistic]);
        try {
            if (isGroupThread && chatGroupId) {
                await appendGroupChatMessage(user.handle, chatGroupId, { imageUrl: optimistic.imageUrl, text: optimistic.text });
            } else {
                await appendMessage(user.handle, handle, { imageUrl: optimistic.imageUrl, text: optimistic.text });
            }
            await loadMessages(true);
        } catch (error) {
            console.error('Error sending image message:', error);
            showAlert({
                title: 'Send failed',
                message: 'Could not send image message.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
        }
    };

    const handleSendSticker = async (emoji: string) => {
        if (!user?.handle || !emoji) return;
        if (stickerTargetMessageId) {
            handleToggleReaction(stickerTargetMessageId, emoji);
            setStickerTargetMessageId(null);
            setShowStickerPicker(false);
            return;
        }
        const optimistic: ChatMessage = {
            id: `${Date.now()}-sticker`,
            senderHandle: user.handle,
            text: emoji,
            timestamp: Date.now(),
        };
        setShowStickerPicker(false);
        shouldAutoScrollRef.current = true;
        setMessages((prev) => [...prev, optimistic]);
        try {
            if (isGroupThread && chatGroupId) {
                await appendGroupChatMessage(user.handle, chatGroupId, { text: emoji });
            } else {
                await appendMessage(user.handle, handle, { text: emoji });
            }
            await loadMessages(true);
        } catch (error) {
            console.error('Error sending sticker:', error);
            showAlert({
                title: 'Send failed',
                message: 'Could not send sticker.',
                icon: 'alert',
                confirmButtonText: 'OK',
            });
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
            const optimistic: ChatMessage = {
                id: `${Date.now()}-audio`,
                senderHandle: user.handle,
                audioUrl,
                timestamp: Date.now(),
            };
            shouldAutoScrollRef.current = true;
            setMessages((prev) => [...prev, optimistic]);
            if (isGroupThread && chatGroupId) {
                await appendGroupChatMessage(user.handle, chatGroupId, { audioUrl });
            } else {
                await appendMessage(user.handle, handle, { audioUrl });
            }
            await loadMessages(true);
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

    const voiceMicActionsRef = useRef({
        startVoiceRecording,
        pauseVoiceRecordingForPreview,
        cancelVoiceRecording,
    });
    voiceMicActionsRef.current = {
        startVoiceRecording,
        pauseVoiceRecordingForPreview,
        cancelVoiceRecording,
    };

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

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const isFromMe = item.senderHandle === user?.handle;
        const senderAvatar = getAvatarForHandle(item.senderHandle);
        const isStoryReplyContext =
            !!item.isSystemMessage &&
            typeof item.text === 'string' &&
            item.text.trim().toLowerCase().startsWith('replying to @') &&
            item.text.toLowerCase().includes('story');

        const bubblePanResponder = PanResponder.create({
            onStartShouldSetPanResponder: () => !isFromMe,
            onMoveShouldSetPanResponder: (_evt, gestureState) =>
                !isFromMe && gestureState.dx > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
            onPanResponderGrant: (evt) => {
                swipeStartRef.current = {
                    x: evt.nativeEvent.pageX,
                    y: evt.nativeEvent.pageY,
                    message: item,
                };
                setSwipingMessageId(item.id);
                setSwipeOffset(0);
            },
            onPanResponderMove: (_evt, gestureState) => {
                if (isFromMe) return;
                const dx = Math.max(0, gestureState.dx);
                const dy = Math.abs(gestureState.dy);
                if (dx > dy) {
                    setSwipeOffset(Math.min(dx, 84));
                }
            },
            onPanResponderRelease: () => {
                const shouldReply = !isFromMe && swipingMessageId === item.id && swipeOffset > 48;
                if (shouldReply) {
                    setReplyingTo(item);
                    setEditingMessage(null);
                }
                setSwipingMessageId(null);
                setSwipeOffset(0);
                swipeStartRef.current = null;
            },
            onPanResponderTerminate: () => {
                setSwipingMessageId(null);
                setSwipeOffset(0);
                swipeStartRef.current = null;
            },
        });

        if (isStoryReplyContext) {
            return (
                <View style={styles.storyContextWrap}>
                    <View style={styles.storyContextCard}>
                        <Text style={styles.storyContextLabel}>Story context</Text>
                        <Text style={styles.storyContextText}>{item.text}</Text>
                    </View>
                </View>
            );
        }

        const sentBubbleColor = dmSentBubbleColor(dmSentStyle);
        const isMediaOnlyMessage = Boolean(
            item.imageUrl && !item.text?.trim() && !item.audioUrl && !(item as any).replyTo
        );
        const bubbleFill = isFromMe ? sentBubbleColor : DM_RECEIVED;

        const myAvatar = user?.avatarUrl || (user?.handle ? getAvatarForHandle(user.handle) : undefined);

        const bubbleContent = (
            <>
                {(item as any).replyTo ? (
                    <View style={styles.replyPreviewWrap}>
                        <View style={styles.replyPreviewBar} />
                        {((item as any).replyTo?.imageUrl as string | undefined) ? (
                            <View style={styles.replyPreviewThumb}>
                                {isLikelyVideoUrl((item as any).replyTo.imageUrl) ? (
                                    <View style={styles.replyPreviewVideoBadge}>
                                        <Icon name="videocam" size={12} color="#FFFFFF" />
                                    </View>
                                ) : (
                                    <Image
                                        source={{ uri: (item as any).replyTo.imageUrl }}
                                        style={styles.replyPreviewImage}
                                    />
                                )}
                            </View>
                        ) : null}
                        <View style={styles.replyPreviewTextWrap}>
                            <Text style={styles.replyPreviewSender} numberOfLines={1}>
                                {(item as any).replyTo?.senderHandle || 'Reply'}
                            </Text>
                            <Text style={styles.replyPreviewText} numberOfLines={1}>
                                {(item as any).replyTo?.imageUrl
                                    ? isLikelyVideoUrl((item as any).replyTo.imageUrl)
                                        ? 'Video'
                                        : 'Photo'
                                    : (item as any).replyTo?.text || 'Message'}
                            </Text>
                        </View>
                    </View>
                ) : null}
                {item.text ? (
                    <Text
                        style={[
                            styles.messageText,
                            isMediaOnlyMessage ? styles.messageTextPlain : null,
                            isFromMe ? styles.messageTextFromMe : styles.messageTextFromOther,
                        ]}
                    >
                        {translatedMessages[item.id] || item.text}
                    </Text>
                ) : null}
                {!!translatedMessages[item.id] && !!item.text ? (
                    <Text style={styles.translatedOriginalText}>Original: {item.text}</Text>
                ) : null}
                {item.imageUrl ? (
                    isLikelyVideoUrl(item.imageUrl) ? (
                        <View style={styles.messageVideoFallback}>
                            <Icon name="videocam" size={18} color="#FFFFFF" />
                            <Text style={styles.messageVideoFallbackText}>Video</Text>
                        </View>
                    ) : (
                        <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
                    )
                ) : null}
                {item.audioUrl ? (
                    <TouchableOpacity
                        style={styles.audioMessagePill}
                        onPress={() => {
                            void handlePlayAudioMessage(item.audioUrl);
                        }}
                    >
                        <Icon
                            name={playingAudioId === item.audioUrl ? 'pause' : 'play'}
                            size={16}
                            color="#FFFFFF"
                        />
                        <Text style={styles.audioMessageText}>
                            {playingAudioId === item.audioUrl ? 'Playing...' : 'Voice message'}
                        </Text>
                    </TouchableOpacity>
                ) : null}
                {!!messageReactions[item.id]?.length && (
                    <View style={styles.reactionsRow}>
                        {messageReactions[item.id].map((reaction) => (
                            <TouchableOpacity
                                key={`${item.id}-${reaction.emoji}`}
                                style={styles.reactionPill}
                                onPress={() => handleToggleReaction(item.id, reaction.emoji)}
                            >
                                <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                                {reaction.users.length > 1 && (
                                    <Text style={styles.reactionCount}>{reaction.users.length}</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </>
        );

        const messageMeta = (
            <View style={[styles.messageMetaRow, isFromMe ? styles.messageMetaRowMe : styles.messageMetaRowOther]}>
                <Text style={styles.messageTimeOutside}>{timeAgo(item.timestamp)}</Text>
                {isFromMe && !isGroupThread ? (
                    <Icon
                        name="checkmark-done"
                        size={13}
                        color={(item as any).read ? dmSentBubbleColor(dmSentStyle) : '#8E8E93'}
                    />
                ) : null}
            </View>
        );

        const bubbleShell = (
            <IMessageDmBubbleShell
                isFromMe={isFromMe}
                tailBackgroundColor={bubbleFill}
                showTail={!isMediaOnlyMessage}
                bubbleStyle={
                    isMediaOnlyMessage
                        ? {
                              backgroundColor: 'transparent',
                              paddingHorizontal: 0,
                              paddingVertical: 0,
                              shadowOpacity: 0,
                              elevation: 0,
                          }
                        : messageReactions[item.id]?.length
                          ? { paddingBottom: 22 }
                          : undefined
                }
            >
                {bubbleContent}
            </IMessageDmBubbleShell>
        );

        return (
            <View style={[
                styles.messageContainer,
                isFromMe ? styles.messageFromMe : styles.messageFromOther,
            ]}>
                {!isFromMe ? (
                    <Avatar src={senderAvatar} name={item.senderHandle.split('@')[0]} size={32} />
                ) : null}
                {!isFromMe && swipingMessageId === item.id && swipeOffset > 18 ? (
                    <View style={styles.swipeReplyCue}>
                        <Icon name="arrow-undo" size={14} color="#E5E7EB" />
                    </View>
                ) : null}
                <View style={[styles.messageColumn, isFromMe ? styles.messageColumnMe : styles.messageColumnOther]}>
                    <Animated.View
                        {...bubblePanResponder.panHandlers}
                        style={
                            !isFromMe && swipingMessageId === item.id
                                ? { transform: [{ translateX: swipeOffset }] }
                                : undefined
                        }
                    >
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onLongPress={() => openMessageActions(item)}
                        >
                            {bubbleShell}
                        </TouchableOpacity>
                    </Animated.View>
                    {messageMeta}
                </View>
                {isFromMe ? (
                    <Avatar
                        src={myAvatar}
                        name={user?.name || user?.handle || 'You'}
                        size={32}
                    />
                ) : null}
            </View>
        );
    };

    return (
        <GazetteerScreenShell>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Avatar
                        src={isGroupThread ? groupAvatarUrl : getAvatarForHandle(handle)}
                        name={isGroupThread ? (groupName || 'Group') : (handle?.split('@')[0] || 'User')}
                        size={32}
                    />
                    <Text style={styles.headerName}>{isGroupThread ? groupName : handle}</Text>
                </View>
                <View style={styles.headerActions}>
                    {isGroupThread ? (
                        <TouchableOpacity
                            onPress={() => setInviteOpen(true)}
                            style={styles.headerActionButton}
                            accessibilityLabel="Invite to group"
                        >
                            <Icon name="person-add-outline" size={22} color="#C4B5FD" />
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity style={styles.headerActionButton} onPress={openHeaderActions}>
                        <Icon name="ellipsis-horizontal" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
                keyboardVerticalOffset={90}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    style={styles.messagesList}
                    contentContainerStyle={[
                        styles.messagesContent,
                        messages.length === 0 ? styles.messagesContentEmpty : null,
                    ]}
                    maintainVisibleContentPosition={{
                        minIndexForVisible: 0,
                        autoscrollToTopThreshold: 12,
                    }}
                    onContentSizeChange={() => {
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
                    <View style={styles.composerContextWrap}>
                        <View style={styles.composerContextBar} />
                        <View style={styles.composerContextBody}>
                            <Text style={styles.composerContextTitle}>
                                {editingMessage ? 'Editing message' : `Replying to ${replyingTo?.senderHandle || ''}`}
                            </Text>
                            <Text style={styles.composerContextText} numberOfLines={1}>
                                {editingMessage?.text || replyingTo?.text || (replyingTo?.imageUrl ? 'Photo' : 'Message')}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                setReplyingTo(null);
                                setEditingMessage(null);
                                setMessageText('');
                            }}
                        >
                            <Icon name="close" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
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
                {voiceDraft && (
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
                                <Icon name="trash-outline" size={20} color="#9CA3AF" />
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
                                    size={18}
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
                                    <Icon name="mic" size={16} color="#FDE68A" />
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
                                <Icon name="send" size={20} color="#000000" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                {!voiceDraft ? (
                <View style={styles.inputContainer}>
                    <View style={styles.inputRow}>
                        {isRecordingVoice ? (
                            <View style={styles.voiceActiveBar}>
                                <TouchableOpacity
                                    style={styles.voiceRecordingCancelBtn}
                                    onPress={() => {
                                        void cancelVoiceRecording();
                                    }}
                                    accessibilityLabel="Discard recording"
                                >
                                    <Icon name="trash-outline" size={18} color="#9CA3AF" />
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
                            <View style={styles.inputShell}>
                                <TouchableOpacity style={styles.inputIconInside} onPress={handleImageClick}>
                                    <Icon name="add" size={22} color="#FFFFFF" />
                                </TouchableOpacity>
                                <TextInput
                                    value={messageText}
                                    onChangeText={setMessageText}
                                    placeholder={composerPlaceholder}
                                    placeholderTextColor="#737373"
                                    style={styles.input}
                                    multiline
                                    maxLength={1000}
                                />
                                <TouchableOpacity
                                    style={styles.inputIconRight}
                                    onPress={() => {
                                        setStickerTargetMessageId(null);
                                        setShowStickerPicker(true);
                                    }}
                                >
                                    <Icon name="happy-outline" size={20} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                        )}
                        <View
                            {...voiceMicPanResponder.panHandlers}
                            style={[
                                styles.composerMicButton,
                                isRecordingVoice && styles.composerMicButtonActive,
                            ]}
                            accessibilityLabel={isRecordingVoice ? 'Stop recording' : 'Record voice message'}
                        >
                            <Icon
                                name={isRecordingVoice ? 'square' : 'mic'}
                                size={isRecordingVoice ? 15 : 17}
                                color={isRecordingVoice ? '#000000' : '#D4AF37'}
                            />
                        </View>
                        {messageText.trim() && !isRecordingVoice ? (
                            <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
                                <Icon name="send" size={20} color="#000000" />
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
                <View style={styles.sheetCard}>
                    <Text style={styles.sheetTitle}>Create group</Text>
                    <Text style={styles.sheetLabel}>Group name</Text>
                    <TextInput
                        value={newGroupName}
                        onChangeText={setNewGroupName}
                        placeholder="e.g. Dublin creators"
                        placeholderTextColor="#6B7280"
                        style={styles.sheetInput}
                        maxLength={80}
                    />
                    <Text style={styles.sheetLabel}>Group photo (optional)</Text>
                    <View style={styles.groupPhotoRow}>
                        <Avatar src={newGroupAvatarDataUrl} name={newGroupName || 'Group'} size={42} />
                        <TouchableOpacity style={styles.sheetSecondaryBtn} onPress={pickGroupAvatar}>
                            <Text style={styles.sheetSecondaryBtnText}>{newGroupAvatarDataUrl ? 'Change photo' : 'Choose photo'}</Text>
                        </TouchableOpacity>
                        {!!newGroupAvatarDataUrl && (
                            <TouchableOpacity style={styles.sheetSecondaryBtn} onPress={() => setNewGroupAvatarDataUrl(undefined)}>
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
                            <Text style={styles.sheetPrimaryBtnText}>{creatingGroup ? 'Creating...' : 'Create'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <View style={[styles.sheetOverlay, !inviteOpen && styles.hidden]}>
                <View style={styles.sheetCard}>
                    <Text style={styles.sheetTitle}>Invite member</Text>
                    <Text style={styles.sheetLabel}>Handle</Text>
                    <TextInput
                        value={inviteHandle}
                        onChangeText={setInviteHandle}
                        placeholder="@username"
                        placeholderTextColor="#6B7280"
                        style={styles.sheetInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {inviteSearching ? (
                        <Text style={styles.suggestionsHint}>Searching...</Text>
                    ) : inviteSuggestions.length > 0 ? (
                        <View style={styles.suggestionsList}>
                            {inviteSuggestions.map((u) => (
                                <TouchableOpacity key={u.handle} style={styles.suggestionRow} onPress={() => setInviteHandle(u.handle)}>
                                    <Avatar src={u.avatarUrl} name={u.handle} size={28} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.suggestionHandle}>{u.handle}</Text>
                                        {!!u.displayName && <Text style={styles.suggestionName}>{u.displayName}</Text>}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.suggestionsHint}>Type at least 2 characters to see suggestions.</Text>
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
                            <Text style={styles.sheetPrimaryBtnText}>{inviteBusy ? 'Sending...' : 'Send invite'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <View style={[styles.sheetOverlay, !showChatInfo && styles.hidden]}>
                <TouchableOpacity
                    style={styles.sheetBackdropTap}
                    activeOpacity={1}
                    onPress={() => setShowChatInfo(false)}
                />
                <View style={styles.chatInfoSheet}>
                    <View style={styles.chatInfoHeader}>
                        <Text style={styles.chatInfoTitle}>Chat Info</Text>
                        <TouchableOpacity onPress={() => setShowChatInfo(false)}>
                            <Icon name="close" size={24} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                    {isGroupThread ? (
                        <View style={styles.chatInfoBody}>
                            <View style={styles.chatInfoProfileRow}>
                                <Avatar
                                    src={groupAvatarUrl}
                                    name={groupName || 'Group'}
                                    size={56}
                                />
                                <View style={styles.chatInfoProfileText}>
                                    <Text style={styles.chatInfoName}>{groupName}</Text>
                                    <Text style={styles.chatInfoSubtitle}>Group chat</Text>
                                </View>
                            </View>
                            <Text style={styles.chatInfoHint}>
                                To add people, use the + button in the chat header, or open someone&apos;s profile
                                and choose Invite to group.
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
                                        <Icon name="close-circle-outline" size={20} color="#EF4444" />
                                        <Text style={styles.leaveGroupBtnText}>Leave Group</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : null}
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
    threadLoadingWrap: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 48,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        ...gazetteerHeader,
    },
    headerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
        marginLeft: 16,
    },
    headerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerActionButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
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
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 12,
    },
    messagesContentEmpty: {
        justifyContent: 'center',
    },
    loadingOlderWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    loadingOlderText: {
        color: '#9CA3AF',
        fontSize: 12,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: 10,
        alignItems: 'flex-end',
        gap: 7,
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
        maxWidth: '82%',
    },
    messageColumnMe: {
        alignItems: 'flex-end',
    },
    messageColumnOther: {
        alignItems: 'flex-start',
        flex: 1,
    },
    messageMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingTop: 4,
        paddingHorizontal: 2,
    },
    messageMetaRowMe: {
        justifyContent: 'flex-end',
    },
    messageMetaRowOther: {
        justifyContent: 'flex-start',
    },
    messageTimeOutside: {
        fontSize: 10,
        color: '#8E8E93',
    },
    messageTextPlain: {
        fontSize: 15,
        lineHeight: 20,
        color: '#FFFFFF',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 21,
        flexShrink: 1,
    },
    messageTextFromMe: {
        color: '#FFFFFF',
    },
    messageTextFromOther: {
        color: '#F9FAFB',
    },
    messageImage: {
        width: 200,
        height: 200,
        borderRadius: 12,
        marginTop: 8,
    },
    messageVideoFallback: {
        width: 200,
        height: 120,
        borderRadius: 12,
        marginTop: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.24)',
        backgroundColor: '#111827',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    messageVideoFallbackText: {
        color: '#E5E7EB',
        fontSize: 13,
        fontWeight: '700',
    },
    audioMessagePill: {
        marginTop: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.24)',
        backgroundColor: 'rgba(0,0,0,0.25)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
    },
    audioMessageText: {
        color: '#F3F4F6',
        fontSize: 12,
        fontWeight: '700',
    },
    messageTime: {
        fontSize: 10,
        marginTop: 3,
    },
    messageTimeFromMe: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
    messageTimeFromOther: {
        color: '#9CA3AF',
    },
    storyContextWrap: {
        alignItems: 'center',
        marginBottom: 12,
    },
    storyContextCard: {
        maxWidth: '86%',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(103, 232, 249, 0.3)',
        backgroundColor: 'rgba(6, 182, 212, 0.12)',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    storyContextLabel: {
        fontSize: 10,
        color: '#A5F3FC',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        fontWeight: '700',
        marginBottom: 4,
    },
    storyContextText: {
        fontSize: 13,
        color: '#F9FAFB',
        lineHeight: 18,
    },
    inputContainer: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
    },
    composerContextWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 6,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
    },
    composerContextBar: {
        width: 2,
        height: 34,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.35)',
    },
    composerContextBody: {
        flex: 1,
    },
    composerContextTitle: {
        color: '#9CA3AF',
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 1,
    },
    composerContextText: {
        color: '#E5E7EB',
        fontSize: 13,
    },
    inputShell: {
        flex: 1,
        position: 'relative',
        justifyContent: 'center',
    },
    inputIconInside: {
        position: 'absolute',
        left: 12,
        zIndex: 2,
    },
    inputIconRight: {
        position: 'absolute',
        right: 12,
        zIndex: 2,
        elevation: 3,
    },
    input: {
        width: '100%',
        minHeight: 44,
        backgroundColor: '#09090b',
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        paddingLeft: 42,
        paddingRight: 42,
        paddingVertical: 10,
        color: '#FFFFFF',
        fontSize: 15,
        maxHeight: 100,
    },
    composerMicButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4B5563',
        borderWidth: 1,
        borderColor: '#D4AF37',
        shadowColor: '#E5E7EB',
        shadowOpacity: 0.35,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 1 },
        elevation: 3,
    },
    composerMicButtonActive: {
        backgroundColor: '#D4AF37',
        borderColor: '#FFFFFF',
    },
    recordingBadge: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#D4AF37',
        backgroundColor: 'rgba(212,175,55,0.15)',
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    recordingBadgeText: {
        color: '#FDE68A',
        fontSize: 11,
        fontWeight: '700',
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
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
        marginHorizontal: 16,
        marginBottom: 6,
    },
    recordingHintText: {
        color: '#D4AF37',
        fontSize: 12,
        fontWeight: '700',
    },
    recordingHintSubtleText: {
        color: '#6B7280',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 6,
        marginHorizontal: 4,
        textAlign: 'center',
    },
    voiceReviewSection: {
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 4,
    },
    voiceReviewLabel: {
        color: '#9CA3AF',
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 2,
    },
    voiceReviewBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        backgroundColor: '#09090b',
    },
    voiceReviewIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    voiceReviewPlayBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center',
    },
    voiceReviewTrackWrap: {
        flex: 1,
        minWidth: 0,
        gap: 4,
    },
    voiceReviewTrack: {
        height: 4,
        borderRadius: 999,
        backgroundColor: '#374151',
        overflow: 'hidden',
    },
    voiceReviewTrackFill: {
        height: '100%',
        borderRadius: 999,
        backgroundColor: '#D4AF37',
    },
    voiceReviewDuration: {
        color: '#9CA3AF',
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'right',
    },
    voiceReviewRecordBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#92400E',
        backgroundColor: 'rgba(180,83,9,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 7,
    },
    voiceReviewRecordText: {
        color: '#FDE68A',
        fontSize: 12,
        fontWeight: '700',
    },
    voiceActiveBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 44,
        paddingHorizontal: 10,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        backgroundColor: '#09090b',
        gap: 10,
    },
    voiceHoldCenter: {
        alignItems: 'center',
        flex: 1,
    },
    voiceHoldTimer: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    voiceHoldHint: {
        color: '#D4AF37',
        fontSize: 11,
        fontWeight: '700',
        marginTop: 2,
    },
    voiceRecDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#D4AF37',
    },
    voiceRecordingCancelBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#4B5563',
        backgroundColor: 'rgba(75,85,99,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    readReceiptWrap: {
        alignSelf: 'flex-end',
        marginTop: 2,
    },
    replyPreviewWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    replyPreviewBar: {
        width: 2,
        alignSelf: 'stretch',
        backgroundColor: 'rgba(255,255,255,0.35)',
        borderRadius: 2,
        marginRight: 8,
    },
    replyPreviewThumb: {
        width: 36,
        height: 36,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#000000',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        marginRight: 8,
    },
    replyPreviewImage: {
        width: '100%',
        height: '100%',
    },
    replyPreviewVideoBadge: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111827',
    },
    replyPreviewTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    replyPreviewSender: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 11,
        marginBottom: 2,
        fontWeight: '600',
    },
    replyPreviewText: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: 12,
    },
    swipeReplyCue: {
        width: 22,
        height: 22,
        borderRadius: 11,
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
        gap: 4,
    },
    reactionPill: {
        borderRadius: 999,
        paddingHorizontal: 7,
        paddingVertical: 3,
        backgroundColor: 'rgba(255,255,255,0.92)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    reactionEmoji: {
        fontSize: 12,
    },
    reactionCount: {
        color: '#374151',
        fontSize: 10,
        fontWeight: '700',
    },
    translatedOriginalText: {
        marginTop: 4,
        fontSize: 11,
        lineHeight: 15,
        color: 'rgba(255,255,255,0.6)',
        fontStyle: 'italic',
    },
    stickerPicker: {
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        padding: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
    },
    stickerBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1F2937',
    },
    stickerBtnText: {
        fontSize: 18,
    },
    stickerCloseBtn: {
        marginLeft: 'auto',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#4B5563',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    stickerCloseBtnText: {
        color: '#E5E7EB',
        fontSize: 12,
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
        backgroundColor: '#111827',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
        borderColor: '#374151',
        maxHeight: '80%',
    },
    chatInfoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    chatInfoTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    chatInfoBody: {
        padding: 16,
        paddingBottom: 24,
    },
    chatInfoProfileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 20,
    },
    chatInfoProfileText: {
        flex: 1,
        minWidth: 0,
    },
    chatInfoName: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    chatInfoSubtitle: {
        color: '#9CA3AF',
        fontSize: 14,
        marginTop: 2,
    },
    chatInfoHint: {
        color: '#9CA3AF',
        fontSize: 12,
        lineHeight: 18,
        marginBottom: 16,
    },
    leaveGroupBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
    },
    leaveGroupBtnText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '600',
    },
    sheetCard: {
        backgroundColor: '#030712',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderTopWidth: 1,
        borderColor: '#1F2937',
        padding: 16,
    },
    sheetTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    sheetLabel: {
        color: '#D1D5DB',
        fontSize: 13,
        marginBottom: 6,
    },
    sheetInput: {
        backgroundColor: '#111827',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FFFFFF',
        color: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        marginBottom: 12,
    },
    groupPhotoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
    },
    sheetActionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    sheetSecondaryBtn: {
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    sheetSecondaryBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    sheetPrimaryBtn: {
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    sheetPrimaryBtnDisabled: {
        opacity: 0.6,
    },
    sheetPrimaryBtnText: {
        color: '#030712',
        fontSize: 13,
        fontWeight: '700',
    },
    suggestionsList: {
        marginBottom: 12,
        backgroundColor: '#111827',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#374151',
        overflow: 'hidden',
    },
    suggestionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    suggestionHandle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    suggestionName: {
        color: '#9CA3AF',
        fontSize: 12,
    },
    suggestionsHint: {
        color: '#9CA3AF',
        fontSize: 12,
        marginBottom: 12,
    },
    imageComposeWrap: {
        flexDirection: 'row',
        gap: 10,
        marginHorizontal: 16,
        marginTop: 8,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
    },
    imageComposePreview: {
        width: 64,
        height: 64,
        borderRadius: 10,
    },
    imageComposeBody: {
        flex: 1,
    },
    imageComposeTitle: {
        color: '#E5E7EB',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 6,
    },
    imageComposeInput: {
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#4B5563',
        backgroundColor: '#0F172A',
        color: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 13,
    },
    imageComposeActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 8,
    },
    imageComposeCancelBtn: {
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#4B5563',
        backgroundColor: '#1F2937',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    imageComposeCancelText: {
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '700',
    },
    imageComposeSendBtn: {
        borderRadius: 8,
        backgroundColor: '#3B82F6',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    imageComposeSendText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
});













import React, { useState, useEffect, useRef } from 'react';
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
    Alert,
    Animated,
    PanResponder,
    Linking,
    PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
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
import { createChatGroup, inviteUserToChatGroup } from '../api/chatGroups';
import { getAvatarForHandle } from '../api/users';
import { unifiedSearch } from '../api/search';
import { timeAgo } from '../utils/timeAgo';
import Avatar from '../components/Avatar';

const DEBUG_MESSAGE_PAGING =
    __DEV__ && (globalThis as { __CLIPS_DEBUG_MESSAGE_PAGING__?: boolean }).__CLIPS_DEBUG_MESSAGE_PAGING__ === true;

export default function MessagesScreen({ route, navigation }: any) {
    const { handle, chatGroupId } = route.params || {};
    const isGroupThread = Boolean(chatGroupId);
    const { user } = useAuth();
    const [groupName, setGroupName] = useState('Group');
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
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const shouldAutoScrollRef = useRef(true);
    const [swipingMessageId, setSwipingMessageId] = useState<string | null>(null);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const swipeStartRef = useRef<{ x: number; y: number; message: ChatMessage | null } | null>(null);
    const audioRecorderRef = useRef(AudioRecorderPlayer);

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
                Alert.alert('Edit unavailable', 'Editing is currently available for direct messages only.');
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
        Alert.alert(
            'Message actions',
            'Choose an action',
            [
                {
                    text: 'React ❤️',
                    onPress: () => handleToggleReaction(item.id, '❤️'),
                },
                {
                    text: 'React 😂',
                    onPress: () => handleToggleReaction(item.id, '😂'),
                },
                {
                    text: 'React 🔥',
                    onPress: () => handleToggleReaction(item.id, '🔥'),
                },
                {
                    text: 'Reply',
                    onPress: () => {
                        setReplyingTo(item);
                        setEditingMessage(null);
                    },
                },
                ...(item.storyId
                    ? [{
                        text: 'View story',
                        onPress: () => {
                            navigation.navigate('Stories', {
                                openUserHandle: item.senderHandle || handle,
                                openStoryId: item.storyId,
                            });
                        },
                    }]
                    : []),
                ...(fromMe && !isGroupThread
                    ? [{
                        text: 'Edit',
                        onPress: () => {
                            setEditingMessage(item);
                            setReplyingTo(null);
                            setMessageText(item.text || '');
                        },
                    }]
                    : []),
                ...(!fromMe
                    ? [{
                        text: 'View profile',
                        onPress: () => {
                            navigation.navigate('ViewProfile', { handle: item.senderHandle });
                        },
                    }]
                    : []),
                ...(item.text
                    ? [{
                        text: 'Copy text',
                        onPress: () => {
                            Clipboard.setString(item.text || '');
                            Alert.alert('Copied', 'Message text copied to clipboard.');
                        },
                    }, {
                        text: translatedMessages[item.id] ? 'Hide translation' : 'Translate',
                        onPress: () => {
                            void handleTranslateMessage(item);
                        },
                    }]
                    : []),
                {
                    text: 'Add sticker',
                    onPress: () => {
                        setStickerTargetMessageId(item.id);
                        setShowStickerPicker(true);
                    },
                },
                {
                    text: 'Forward',
                    onPress: () => {
                        void handleForwardMessage(item);
                    },
                },
                {
                    text: 'Report',
                    onPress: () => {
                        handleReportMessage(item);
                    },
                    style: 'destructive',
                },
                { text: 'Cancel', style: 'cancel' },
            ],
            { cancelable: true },
        );
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
            Alert.alert('Translate failed', 'Could not translate this message right now.');
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
                Alert.alert('No conversations', 'No other direct conversations available to forward to.');
                return;
            }
            const options: Array<{ text: string; onPress: () => void; style?: 'cancel' | 'destructive' }> = dmTargets.map((target) => ({
                text: target,
                onPress: () => {
                    void (async () => {
                        try {
                            await appendMessage(user.handle, target, {
                                text: item.text ? `Forwarded: ${item.text}` : undefined,
                                imageUrl: item.imageUrl,
                                audioUrl: item.audioUrl,
                            });
                            Alert.alert('Forwarded', `Sent to ${target}`);
                        } catch {
                            Alert.alert('Forward failed', 'Could not forward this message right now.');
                        }
                    })();
                },
            }));
            options.push({ text: 'Cancel', style: 'cancel', onPress: () => {} });
            Alert.alert('Forward message', 'Choose conversation', options);
        } catch {
            Alert.alert('Forward failed', 'Could not load conversations right now.');
        }
    };

    const handleReportMessage = (item: ChatMessage) => {
        Alert.alert(
            'Report message',
            `Why are you reporting ${item.senderHandle}'s message?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Spam',
                    onPress: () => {
                        Alert.alert('Reported', 'Thanks. We have flagged this message for spam review.');
                    },
                },
                {
                    text: 'Harassment',
                    onPress: () => {
                        Alert.alert('Reported', 'Thanks. We have flagged this message for harassment review.');
                    },
                },
                {
                    text: 'Other',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert('Reported', 'Thanks. We have flagged this message for review.');
                    },
                },
            ],
            { cancelable: true },
        );
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
                    Alert.alert('Photo error', response.errorMessage || 'Could not open your photo library.');
                    return;
                }
                const asset = response.assets?.[0];
                if (!asset) return;
                const mime = asset.type || 'image/jpeg';
                const dataUrl = asset.base64 ? `data:${mime};base64,${asset.base64}` : asset.uri;
                if (!dataUrl) return;
                setNewGroupAvatarDataUrl(dataUrl);
            },
        );
    };

    const handleCreateGroup = async () => {
        if (!user?.handle || creatingGroup) return;
        const trimmed = newGroupName.trim();
        if (!trimmed) {
            Alert.alert('Group name required', 'Enter a group name to continue.');
            return;
        }
        setCreatingGroup(true);
        try {
            const created = await createChatGroup(trimmed, user.handle, newGroupAvatarDataUrl || null);
            if (!created?.id) {
                Alert.alert('Create failed', 'Could not create group right now.');
                return;
            }
            setCreateGroupOpen(false);
            setNewGroupName('');
            setNewGroupAvatarDataUrl(undefined);
            navigation.navigate('Messages', { chatGroupId: created.id, kind: 'group' });
        } catch (error) {
            console.error('Error creating group:', error);
            Alert.alert('Create failed', 'Could not create group right now.');
        } finally {
            setCreatingGroup(false);
        }
    };

    const handleInviteMember = async () => {
        if (!chatGroupId || inviteBusy) return;
        const normalized = inviteHandle.trim().replace(/^@/, '');
        if (!normalized) {
            Alert.alert('Handle required', 'Type a handle to invite.');
            return;
        }
        setInviteBusy(true);
        try {
            await inviteUserToChatGroup(chatGroupId, normalized);
            setInviteOpen(false);
            setInviteHandle('');
            setInviteSuggestions([]);
            Alert.alert('Invite sent', `@${normalized} will see this invite in notifications.`);
        } catch (error) {
            console.error('Invite failed:', error);
            Alert.alert('Invite failed', 'Could not send invite right now.');
        } finally {
            setInviteBusy(false);
        }
    };

    const openHeaderActions = () => {
        if (isGroupThread) {
            Alert.alert('Group actions', 'Choose an action', [
                { text: 'Invite member', onPress: () => setInviteOpen(true) },
                { text: 'Cancel', style: 'cancel' },
            ]);
            return;
        }
        const toggleMuteAction = isMuted
            ? {
                text: 'Unmute conversation',
                onPress: async () => {
                    if (!user?.handle || !handle) return;
                    try {
                        await unmuteConversation(user.handle, handle);
                        setIsMuted(false);
                    } catch {
                        Alert.alert('Action failed', 'Could not update mute state right now.');
                    }
                },
            }
            : {
                text: 'Mute conversation',
                onPress: async () => {
                    if (!user?.handle || !handle) return;
                    try {
                        await muteConversation(user.handle, handle);
                        setIsMuted(true);
                    } catch {
                        Alert.alert('Action failed', 'Could not update mute state right now.');
                    }
                },
            };
        Alert.alert('Chat actions', 'Choose an action', [
            { text: 'Create group', onPress: () => setCreateGroupOpen(true) },
            toggleMuteAction,
            { text: 'Cancel', style: 'cancel' },
        ]);
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
                    Alert.alert('Image error', response.errorMessage || 'Could not open your photo library.');
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
            Alert.alert('Send failed', 'Could not send image message.');
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
            Alert.alert('Send failed', 'Could not send sticker.');
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

    const startVoiceRecording = async () => {
        if (!user?.handle || isRecordingVoice) return;
        const allowed = await requestMicPermission();
        if (!allowed) {
            Alert.alert('Permission required', 'Microphone permission is required to record voice messages.');
            return;
        }
        try {
            setRecordingSeconds(0);
            await audioRecorderRef.current.startRecorder();
            audioRecorderRef.current.addRecordBackListener((event: any) => {
                const secs = Math.max(0, Math.floor((event.currentPosition || 0) / 1000));
                setRecordingSeconds(secs);
            });
            setIsRecordingVoice(true);
        } catch (error) {
            console.error('Voice record start failed:', error);
            Alert.alert('Record failed', 'Could not start voice recording.');
        }
    };

    const stopVoiceRecording = async () => {
        if (!isRecordingVoice || !user?.handle) return;
        try {
            const audioUrl = await audioRecorderRef.current.stopRecorder();
            audioRecorderRef.current.removeRecordBackListener();
            setIsRecordingVoice(false);
            setRecordingSeconds(0);
            if (!audioUrl) return;
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
        } catch (error) {
            console.error('Voice record stop failed:', error);
            Alert.alert('Send failed', 'Could not send voice message.');
        }
    };

    const handlePlayAudioMessage = async (audioUrl?: string) => {
        if (!audioUrl) return;
        try {
            await audioRecorderRef.current.stopPlayer();
            audioRecorderRef.current.removePlayBackListener();
            await audioRecorderRef.current.startPlayer(audioUrl);
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
                    Alert.alert('Playback unavailable', 'This voice message cannot be played on this device.');
                    return;
                }
                await Linking.openURL(audioUrl);
            } catch {
                Alert.alert('Playback failed', 'Could not open this voice message.');
            }
        }
    };

    useEffect(() => {
        return () => {
            audioRecorderRef.current.stopRecorder().catch(() => {});
            audioRecorderRef.current.removeRecordBackListener();
            audioRecorderRef.current.stopPlayer().catch(() => {});
            audioRecorderRef.current.removePlayBackListener();
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

        return (
            <View style={[
                styles.messageContainer,
                isFromMe ? styles.messageFromMe : styles.messageFromOther,
            ]}>
                {!isFromMe && (
                    <Avatar src={senderAvatar} name={item.senderHandle.split('@')[0]} size={32} />
                )}
                {!isFromMe && swipingMessageId === item.id && swipeOffset > 18 && (
                    <View style={styles.swipeReplyCue}>
                        <Icon name="arrow-undo" size={14} color="#E5E7EB" />
                    </View>
                )}
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
                    style={[
                        styles.messageBubble,
                        isFromMe ? styles.messageBubbleFromMe : styles.messageBubbleFromOther,
                    ]}
                >
                    {(item as any).replyTo && (
                        <View style={styles.replyPreviewWrap}>
                            <View style={styles.replyPreviewBar} />
                            {((item as any).replyTo?.imageUrl as string | undefined) ? (
                                <View style={styles.replyPreviewThumb}>
                                    {isLikelyVideoUrl((item as any).replyTo.imageUrl) ? (
                                        <View style={styles.replyPreviewVideoBadge}>
                                            <Icon name="videocam" size={12} color="#FFFFFF" />
                                        </View>
                                    ) : (
                                        <Image source={{ uri: (item as any).replyTo.imageUrl }} style={styles.replyPreviewImage} />
                                    )}
                                </View>
                            ) : null}
                            <View style={styles.replyPreviewTextWrap}>
                                <Text style={styles.replyPreviewSender} numberOfLines={1}>
                                    {(item as any).replyTo?.senderHandle || 'Reply'}
                                </Text>
                                <Text style={styles.replyPreviewText} numberOfLines={1}>
                                    {(item as any).replyTo?.imageUrl
                                        ? (isLikelyVideoUrl((item as any).replyTo.imageUrl) ? 'Video' : 'Photo')
                                        : ((item as any).replyTo?.text || 'Message')}
                                </Text>
                            </View>
                        </View>
                    )}
                    {item.text && (
                        <Text style={[
                            styles.messageText,
                            isFromMe ? styles.messageTextFromMe : styles.messageTextFromOther,
                        ]}>
                            {item.text}
                        </Text>
                    )}
                    {!!translatedMessages[item.id] && (
                        <Text style={styles.translatedText}>
                            {translatedMessages[item.id]}
                        </Text>
                    )}
                    {item.imageUrl && (
                        isLikelyVideoUrl(item.imageUrl) ? (
                            <View style={styles.messageVideoFallback}>
                                <Icon name="videocam" size={18} color="#FFFFFF" />
                                <Text style={styles.messageVideoFallbackText}>Video</Text>
                            </View>
                        ) : (
                            <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
                        )
                    )}
                    {item.audioUrl && (
                        <TouchableOpacity
                            style={styles.audioMessagePill}
                            onPress={() => {
                                void handlePlayAudioMessage(item.audioUrl);
                            }}
                        >
                            <Icon name={playingAudioId === item.audioUrl ? 'pause' : 'play'} size={16} color="#FFFFFF" />
                            <Text style={styles.audioMessageText}>
                                {playingAudioId === item.audioUrl ? 'Playing...' : 'Voice message'}
                            </Text>
                        </TouchableOpacity>
                    )}
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
                    <Text style={[
                        styles.messageTime,
                        isFromMe ? styles.messageTimeFromMe : styles.messageTimeFromOther,
                    ]}>
                        {timeAgo(item.timestamp)}
                    </Text>
                    {isFromMe && !isGroupThread && (
                        <View style={styles.readReceiptWrap}>
                            <Icon
                                name="checkmark-done"
                                size={13}
                                color={(item as any).read ? '#0A84FF' : '#8E8E93'}
                            />
                        </View>
                    )}
                </TouchableOpacity>
                </Animated.View>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#8B5CF6" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
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
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Inbox', { initialTab: 'insights' })}
                        style={styles.headerActionButton}
                    >
                        <Icon name="bar-chart-outline" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerActionButton} onPress={openHeaderActions}>
                        <Icon name="ellipsis-vertical" size={22} color="#FFFFFF" />
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
                    contentContainerStyle={styles.messagesContent}
                    maintainVisibleContentPosition={{
                        minIndexForVisible: 0,
                        autoscrollToTopThreshold: 12,
                    }}
                    onContentSizeChange={() => {
                        if (shouldAutoScrollRef.current) {
                            flatListRef.current?.scrollToEnd({ animated: true });
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
                <View style={styles.inputContainer}>
                    <View style={styles.inputShell}>
                        <TouchableOpacity style={styles.inputIconInside} onPress={handleImageClick}>
                            <Icon name="add" size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TextInput
                            value={messageText}
                            onChangeText={setMessageText}
                            placeholder="Message..."
                            placeholderTextColor="#6B7280"
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
                    <TouchableOpacity
                        style={[
                            styles.composerMicButton,
                            isRecordingVoice && styles.composerMicButtonActive,
                        ]}
                        onPress={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                    >
                        <Icon
                            name={isRecordingVoice ? 'square' : 'mic'}
                            size={17}
                            color={isRecordingVoice ? '#FFFFFF' : '#D4AF37'}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={messageText.trim() ? handleSend : (isRecordingVoice ? stopVoiceRecording : startVoiceRecording)}
                        style={[
                            styles.sendButton,
                            !messageText.trim() && styles.sendButtonDisabled,
                            isRecordingVoice && styles.sendButtonRecording,
                        ]}
                    >
                        <Icon
                            name={messageText.trim() ? 'send' : (isRecordingVoice ? 'square' : 'mic')}
                            size={20}
                            color={messageText.trim() || isRecordingVoice ? '#FFFFFF' : '#6B7280'}
                        />
                    </TouchableOpacity>
                </View>
                {isRecordingVoice && (
                    <View style={styles.recordingHintWrap}>
                        <Text style={styles.recordingHintText}>Recording voice... {recordingSeconds}s</Text>
                    </View>
                )}
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
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
        paddingHorizontal: 12,
        paddingVertical: 10,
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
    messageBubble: {
        maxWidth: '75%',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 15,
    },
    messageBubbleFromMe: {
        backgroundColor: '#3B82F6',
        borderBottomRightRadius: 4,
    },
    messageBubbleFromOther: {
        backgroundColor: '#1F2937',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 19,
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
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#1F2937',
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
        borderTopColor: '#1F2937',
        backgroundColor: '#030712',
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
        backgroundColor: '#1F2937',
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        paddingLeft: 42,
        paddingRight: 42,
        paddingVertical: 10,
        color: '#FFFFFF',
        fontSize: 16,
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
        backgroundColor: '#B45309',
        borderColor: '#FDE68A',
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#1F2937',
    },
    sendButtonRecording: {
        backgroundColor: '#DC2626',
    },
    recordingHintWrap: {
        marginHorizontal: 16,
        marginBottom: 6,
    },
    recordingHintText: {
        color: '#FCA5A5',
        fontSize: 12,
        fontWeight: '700',
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
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
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
    translatedText: {
        marginTop: 6,
        fontSize: 12,
        lineHeight: 16,
        color: '#D1FAE5',
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
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
        zIndex: 20,
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













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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../context/Auth';
import {
    fetchConversationMessagesPage,
    fetchGroupThreadMessagesPage,
    appendMessage,
    appendGroupChatMessage,
    markConversationRead,
    markGroupConversationReadById,
    editMessage,
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
    const flatListRef = useRef<FlatList>(null);
    const shouldAutoScrollRef = useRef(true);

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
                    text: 'Reply',
                    onPress: () => {
                        setReplyingTo(item);
                        setEditingMessage(null);
                    },
                },
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
                { text: 'Cancel', style: 'cancel' },
            ],
            { cancelable: true },
        );
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
        Alert.alert('Chat actions', 'Choose an action', [
            { text: 'Create group', onPress: () => setCreateGroupOpen(true) },
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

                const optimistic: ChatMessage = {
                    id: `${Date.now()}-img`,
                    senderHandle: user.handle,
                    imageUrl,
                    timestamp: Date.now(),
                };
                shouldAutoScrollRef.current = true;
                setMessages((prev) => [...prev, optimistic]);

                try {
                    if (isGroupThread && chatGroupId) {
                        await appendGroupChatMessage(user.handle, chatGroupId, { imageUrl });
                    } else {
                        await appendMessage(user.handle, handle, { imageUrl });
                    }
                    await loadMessages(true);
                } catch (error) {
                    console.error('Error sending image message:', error);
                    Alert.alert('Send failed', 'Could not send image message.');
                }
            },
        );
    };

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const isFromMe = item.senderHandle === user?.handle;
        const senderAvatar = getAvatarForHandle(item.senderHandle);
        const isStoryReplyContext =
            !!item.isSystemMessage &&
            typeof item.text === 'string' &&
            item.text.trim().toLowerCase().startsWith('replying to @') &&
            item.text.toLowerCase().includes('story');

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
                    {item.imageUrl && (
                        <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
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
                    </View>
                    <TouchableOpacity
                        onPress={handleSend}
                        disabled={!messageText.trim()}
                        style={[
                            styles.sendButton,
                            !messageText.trim() && styles.sendButtonDisabled,
                        ]}
                    >
                        <Icon
                            name="send"
                            size={20}
                            color={messageText.trim() ? "#FFFFFF" : "#6B7280"}
                        />
                    </TouchableOpacity>
                </View>
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
        padding: 16,
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
        marginBottom: 12,
        alignItems: 'flex-end',
        gap: 8,
    },
    messageFromMe: {
        justifyContent: 'flex-end',
    },
    messageFromOther: {
        justifyContent: 'flex-start',
    },
    messageBubble: {
        maxWidth: '75%',
        padding: 10,
        borderRadius: 16,
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
        fontSize: 16,
        lineHeight: 20,
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
    messageTime: {
        fontSize: 11,
        marginTop: 4,
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
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#1F2937',
        gap: 12,
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
    input: {
        width: '100%',
        backgroundColor: '#1F2937',
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        paddingLeft: 42,
        paddingRight: 16,
        paddingVertical: 10,
        color: '#FFFFFF',
        fontSize: 16,
        maxHeight: 100,
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
});













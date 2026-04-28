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
import { getAvatarForHandle } from '../api/users';
import { timeAgo } from '../utils/timeAgo';
import Avatar from '../components/Avatar';

const DEBUG_MESSAGE_PAGING =
    __DEV__ && (globalThis as { __CLIPS_DEBUG_MESSAGE_PAGING__?: boolean }).__CLIPS_DEBUG_MESSAGE_PAGING__ === true;

export default function MessagesScreen({ route, navigation }: any) {
    const { handle, chatGroupId } = route.params || {};
    const isGroupThread = Boolean(chatGroupId);
    const { user } = useAuth();
    const [groupName, setGroupName] = useState('Group');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageText, setMessageText] = useState('');
    const [loading, setLoading] = useState(true);
    const [threadCursor, setThreadCursor] = useState<string | null>(null);
    const [threadHasMore, setThreadHasMore] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const shouldAutoScrollRef = useRef(true);

    const isLikelyVideoUrl = (url?: string) => {
        if (!url) return false;
        const trimmed = url.trim();
        return /^data:video\//i.test(trimmed) || /\.(mp4|webm|m4v|mov)(\?|#|$)/i.test(trimmed);
    };

    useEffect(() => {
        loadMessages(true);
    }, [handle, chatGroupId]);

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
                        src={isGroupThread ? undefined : getAvatarForHandle(handle)}
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
                    <TouchableOpacity style={styles.headerActionButton}>
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
                            <Icon name="image-outline" size={20} color="#FFFFFF" />
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
});













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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { fetchConversationMessagesPage, appendMessage, markConversationRead, type ChatMessage } from '../api/messages';
import { getAvatarForHandle } from '../api/users';
import { timeAgo } from '../utils/timeAgo';
import Avatar from '../components/Avatar';

const DEBUG_MESSAGE_PAGING =
    __DEV__ && (globalThis as { __CLIPS_DEBUG_MESSAGE_PAGING__?: boolean }).__CLIPS_DEBUG_MESSAGE_PAGING__ === true;

export default function MessagesScreen({ route, navigation }: any) {
    const { handle } = route.params;
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageText, setMessageText] = useState('');
    const [loading, setLoading] = useState(true);
    const [threadCursor, setThreadCursor] = useState<string | null>(null);
    const [threadHasMore, setThreadHasMore] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const shouldAutoScrollRef = useRef(true);

    useEffect(() => {
        loadMessages(true);
    }, [handle]);

    useEffect(() => {
        if (messages.length > 0 && user?.handle) {
            markConversationRead(user.handle, handle).catch(console.error);
        }
    }, [messages, handle, user?.handle]);

    const loadMessages = async (reset: boolean = false) => {
        if (!user?.handle) return;
        if (reset) {
            setThreadCursor(null);
            setThreadHasMore(false);
            shouldAutoScrollRef.current = true;
            setLoading(true);
        }
        try {
            const page = await fetchConversationMessagesPage(user.handle, handle, null, 50);
            if (DEBUG_MESSAGE_PAGING) {
                console.info('[RN Messages][dm][initial-page]', {
                    handle,
                    count: page.items.length,
                    nextCursor: page.nextCursor,
                    hasMore: page.hasMore,
                });
            }
            setMessages(page.items);
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
            const page = await fetchConversationMessagesPage(user.handle, handle, threadCursor, 50);
            if (DEBUG_MESSAGE_PAGING) {
                console.info('[RN Messages][dm][older-page]', {
                    handle,
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

        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            senderHandle: user.handle,
            text: messageText.trim(),
            timestamp: Date.now(),
        };

        shouldAutoScrollRef.current = true;
        setMessages(prev => [...prev, newMessage]);
        setMessageText('');

        try {
            await appendMessage(user.handle, handle, { text: newMessage.text });
            await loadMessages(true); // Reload latest page to get server ids/timestamps
        } catch (error) {
            console.error('Error sending message:', error);
        }
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
                    <Avatar
                        src={senderAvatar}
                        name={item.senderHandle.split('@')[0]}
                        size={32}
                    />
                )}
                <View style={[
                    styles.messageBubble,
                    isFromMe ? styles.messageBubbleFromMe : styles.messageBubbleFromOther,
                ]}>
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
                </View>
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
                        src={getAvatarForHandle(handle)}
                        name={handle?.split('@')[0] || 'User'}
                        size={32}
                    />
                    <Text style={styles.headerName}>{handle}</Text>
                </View>
                <TouchableOpacity>
                    <Icon name="ellipsis-vertical" size={24} color="#FFFFFF" />
                </TouchableOpacity>
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

                <View style={styles.inputContainer}>
                    <TouchableOpacity style={styles.inputButton}>
                        <Icon name="image-outline" size={24} color="#8B5CF6" />
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
        padding: 12,
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
    inputButton: {
        padding: 8,
    },
    input: {
        flex: 1,
        backgroundColor: '#1F2937',
        borderRadius: 20,
        paddingHorizontal: 16,
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
});













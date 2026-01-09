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
import { fetchConversation, appendMessage, markConversationRead, type ChatMessage } from '../api/messages';
import { getAvatarForHandle } from '../api/users';
import { timeAgo } from '../utils/timeAgo';
import Avatar from '../components/Avatar';

export default function MessagesScreen({ route, navigation }: any) {
    const { handle } = route.params;
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageText, setMessageText] = useState('');
    const [loading, setLoading] = useState(true);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        loadMessages();
    }, [handle]);

    useEffect(() => {
        if (messages.length > 0 && user?.handle) {
            markConversationRead(user.handle, handle).catch(console.error);
        }
    }, [messages, handle, user?.handle]);

    const loadMessages = async () => {
        if (!user?.handle) return;
        setLoading(true);
        try {
            const conversation = await fetchConversation(user.handle, handle);
            setMessages(conversation);
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!messageText.trim() || !user?.handle) return;

        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            fromHandle: user.handle,
            toHandle: handle,
            text: messageText.trim(),
            timestamp: Date.now(),
            read: false,
        };

        setMessages(prev => [...prev, newMessage]);
        setMessageText('');

        try {
            await appendMessage(user.handle, handle, { text: newMessage.text });
            loadMessages(); // Reload to get server response
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const isFromMe = item.fromHandle === user?.handle;
        const senderAvatar = getAvatarForHandle(item.fromHandle);

        return (
            <View style={[
                styles.messageContainer,
                isFromMe ? styles.messageFromMe : styles.messageFromOther,
            ]}>
                {!isFromMe && (
                    <Avatar
                        src={senderAvatar}
                        name={item.fromHandle.split('@')[0]}
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
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
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













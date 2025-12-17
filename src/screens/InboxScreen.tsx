import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { listConversations, type ConversationSummary } from '../api/messages';
import { getNotifications, type Notification, markNotificationRead } from '../api/notifications';
import { getAvatarForHandle } from '../api/users';
import { timeAgo } from '../utils/timeAgo';
import Avatar from '../components/Avatar';

export default function InboxScreen({ navigation }: any) {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'conversations' | 'notifications'>('notifications');

    useEffect(() => {
        loadData();
    }, [user?.handle]);

    const loadData = async () => {
        if (!user?.handle) return;
        setLoading(true);
        try {
            const [convos, notifs] = await Promise.all([
                listConversations(user.handle),
                getNotifications(user.handle),
            ]);
            setConversations(convos);
            setNotifications(notifs);
        } catch (error) {
            console.error('Error loading inbox:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNotificationPress = async (notif: Notification) => {
        if (!notif.read && user?.handle) {
            await markNotificationRead(notif.id, user.handle);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        }

        if (notif.type === 'sticker' || notif.type === 'reply' || notif.type === 'dm') {
            navigation.navigate('Messages', { handle: notif.fromHandle });
        }
    };

    const handleConversationPress = (handle: string) => {
        navigation.navigate('Messages', { handle });
    };

    const formatNotificationMessage = (notif: Notification): string => {
        switch (notif.type) {
            case 'sticker':
                return `Sent you a sticker: ${notif.message || ''}`;
            case 'reply':
                return `Replied to your post`;
            case 'dm':
                return `Sent you a message`;
            case 'follow_request':
                return `wants to follow you`;
            default:
                return notif.message || '';
        }
    };

    const getNotificationIcon = (type: Notification['type']) => {
        switch (type) {
            case 'sticker':
                return 'happy';
            case 'reply':
                return 'arrow-undo';
            case 'dm':
                return 'chatbubble';
            case 'follow_request':
                return 'person-add';
            default:
                return 'notifications';
        }
    };

    const unreadNotifications = notifications.filter(n => !n.read).length;
    const unreadConversations = conversations.reduce((sum, item) => sum + item.unread, 0);

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
                <Text style={styles.headerTitle}>Inbox</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    onPress={() => setActiveTab('notifications')}
                    style={[styles.tab, activeTab === 'notifications' && styles.tabActive]}
                >
                    <Text style={[styles.tabText, activeTab === 'notifications' && styles.tabTextActive]}>
                        Notifications
                    </Text>
                    {unreadNotifications > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unreadNotifications}</Text>
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('conversations')}
                    style={[styles.tab, activeTab === 'conversations' && styles.tabActive]}
                >
                    <Text style={[styles.tabText, activeTab === 'conversations' && styles.tabTextActive]}>
                        Messages
                    </Text>
                    {unreadConversations > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unreadConversations}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Content */}
            {activeTab === 'notifications' ? (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => handleNotificationPress(item)}
                            style={[styles.item, !item.read && styles.itemUnread]}
                        >
                            <View style={styles.itemIcon}>
                                <Icon
                                    name={getNotificationIcon(item.type)}
                                    size={24}
                                    color="#8B5CF6"
                                />
                            </View>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemTitle}>{item.fromHandle}</Text>
                                <Text style={styles.itemMessage}>{formatNotificationMessage(item)}</Text>
                                <Text style={styles.itemTime}>{timeAgo(item.timestamp)}</Text>
                            </View>
                            {!item.read && <View style={styles.unreadDot} />}
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No notifications</Text>
                        </View>
                    }
                />
            ) : (
                <FlatList
                    data={conversations}
                    keyExtractor={(item) => item.otherHandle}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => handleConversationPress(item.otherHandle)}
                            style={styles.item}
                        >
                            <Avatar
                                src={getAvatarForHandle(item.otherHandle)}
                                name={item.otherHandle.split('@')[0]}
                                size={48}
                            />
                            <View style={styles.itemContent}>
                                <View style={styles.itemHeader}>
                                    <Text style={styles.itemTitle}>{item.otherHandle}</Text>
                                    <Text style={styles.itemTime}>{timeAgo(item.lastMessageTimestamp)}</Text>
                                </View>
                                <Text style={styles.itemMessage} numberOfLines={1}>
                                    {item.lastMessage}
                                </Text>
                            </View>
                            {item.unread > 0 && (
                                <View style={styles.unreadBadge}>
                                    <Text style={styles.unreadBadgeText}>{item.unread}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No messages</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    header: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 8,
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#8B5CF6',
    },
    tabText: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#8B5CF6',
        fontWeight: '600',
    },
    badge: {
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
        gap: 12,
    },
    itemUnread: {
        backgroundColor: '#1F2937',
    },
    itemIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#1F2937',
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemContent: {
        flex: 1,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    itemMessage: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 2,
    },
    itemTime: {
        fontSize: 12,
        color: '#6B7280',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#3B82F6',
    },
    unreadBadge: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    unreadBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#6B7280',
    },
});








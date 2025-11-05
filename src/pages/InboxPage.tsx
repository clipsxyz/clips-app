import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiMessageCircle, FiCornerUpLeft, FiSmile } from 'react-icons/fi';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { listConversations, seedMockDMs, type ConversationSummary } from '../api/messages';
import { getAvatarForHandle } from '../api/users';
import { getNotifications, type Notification, markNotificationRead, markAllNotificationsRead, getUnreadNotificationCount } from '../api/notifications';

export default function InboxPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [items, setItems] = React.useState<ConversationSummary[]>([]);
    const [notifications, setNotifications] = React.useState<Notification[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState<'conversations' | 'notifications'>('notifications');

    const loadData = React.useCallback(async () => {
        if (!user?.handle) return;
        const [conversations, notifs] = await Promise.all([
            listConversations(user.handle),
            getNotifications(user.handle)
        ]);
        setItems(conversations);
        setNotifications(notifs);
        setLoading(false);
    }, [user?.handle]);

    React.useEffect(() => {
        if (!user?.handle) return;
        loadData();

        const onConversationUpdate = () => {
            listConversations(user!.handle!).then(setItems);
        };
        const onNotificationUpdate = () => {
            getNotifications(user!.handle!).then(setNotifications);
        };

        window.addEventListener('conversationUpdated', onConversationUpdate as any);
        window.addEventListener('notificationsUpdated', onNotificationUpdate as any);

        return () => {
            window.removeEventListener('conversationUpdated', onConversationUpdate as any);
            window.removeEventListener('notificationsUpdated', onNotificationUpdate as any);
        };
    }, [user?.handle, loadData]);

    if (!user) {
        return <div className="p-6">Please sign in to view notifications.</div>;
    }

    const unreadNotifications = notifications.filter(n => !n.read).length;
    const unreadConversations = items.reduce((sum, item) => sum + item.unread, 0);

    const handleNotificationClick = async (notif: Notification) => {
        if (!notif.read && user?.handle) {
            await markNotificationRead(notif.id, user.handle);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        }

        if (notif.type === 'sticker' || notif.type === 'reply') {
            navigate(`/messages/${encodeURIComponent(notif.fromHandle)}`);
        } else if (notif.type === 'dm') {
            navigate(`/messages/${encodeURIComponent(notif.fromHandle)}`);
        }
    };

    const formatNotificationMessage = (notif: Notification): string => {
        switch (notif.type) {
            case 'sticker':
                return `Sent you a sticker: ${notif.message || ''}`;
            case 'reply':
                return `Replied to your post`;
            case 'dm':
                return `Sent you a message`;
            default:
                return notif.message || '';
        }
    };

    const getNotificationIcon = (type: Notification['type']) => {
        switch (type) {
            case 'sticker':
                return <FiSmile className="w-5 h-5 text-purple-500" />;
            case 'reply':
                return <FiCornerUpLeft className="w-5 h-5 text-blue-500" />;
            case 'dm':
                return <FiMessageCircle className="w-5 h-5 text-green-500" />;
            default:
                return <FiMessageCircle className="w-5 h-5 text-gray-500" />;
        }
    };

    return (
        <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
                <button
                    onClick={() => navigate('/feed')}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    aria-label="Back to feed"
                >
                    <FiChevronLeft className="w-5 h-5" />
                </button>
                <h1 className="text-xl font-semibold">Notifications</h1>
                <div className="flex-1" />
                {/* Dev-only: seed mock DMs */}
                <button
                    onClick={async () => {
                        if (!user?.handle) return;
                        await seedMockDMs(user.handle);
                        await loadData();
                    }}
                    className="px-3 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                    Add mock DMs
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b border-gray-800">
                <button
                    onClick={() => setActiveTab('notifications')}
                    className={`px-4 py-2 font-medium transition-colors relative ${activeTab === 'notifications'
                            ? 'text-purple-600 border-b-2 border-purple-600'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    Notifications
                    {unreadNotifications > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-pink-500 text-white text-xs rounded-full">
                            {unreadNotifications > 9 ? '9+' : unreadNotifications}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('conversations')}
                    className={`px-4 py-2 font-medium transition-colors relative ${activeTab === 'conversations'
                            ? 'text-purple-600 border-b-2 border-purple-600'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    Messages
                    {unreadConversations > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-pink-500 text-white text-xs rounded-full">
                            {unreadConversations > 9 ? '9+' : unreadConversations}
                        </span>
                    )}
                </button>
            </div>
            {loading ? (
                <div className="text-gray-500">Loading…</div>
            ) : activeTab === 'notifications' ? (
                notifications.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">No notifications yet.</div>
                ) : (
                    <div className="space-y-2">
                        {unreadNotifications > 0 && (
                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={async () => {
                                        if (user?.handle) {
                                            await markAllNotificationsRead(user.handle);
                                            await loadData();
                                        }
                                    }}
                                    className="text-xs text-purple-500 hover:text-purple-400"
                                >
                                    Mark all as read
                                </button>
                            </div>
                        )}
                        {notifications.map(notif => (
                            <button
                                key={notif.id}
                                onClick={() => handleNotificationClick(notif)}
                                className={`w-full text-left flex items-center gap-3 py-3 px-2 rounded-lg transition-colors ${notif.read
                                        ? 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                        : 'bg-purple-900/20 hover:bg-purple-900/30 border-l-4 border-purple-500'
                                    }`}
                            >
                                <div className="flex-shrink-0">
                                    {getNotificationIcon(notif.type)}
                                </div>
                                <Avatar
                                    name={notif.fromHandle}
                                    src={getAvatarForHandle(notif.fromHandle)}
                                    size="sm"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{notif.fromHandle}</div>
                                    <div className="text-xs text-gray-500 truncate">
                                        {formatNotificationMessage(notif)}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="text-[10px] text-gray-400">
                                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    {!notif.read && (
                                        <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )
            ) : items.length === 0 ? (
                <div className="text-gray-500">No conversations yet.</div>
            ) : (
                <div className="divide-y divide-gray-800/40">
                    {items.map(it => (
                        <button
                            key={it.otherHandle}
                            onClick={() => navigate(`/messages/${encodeURIComponent(it.otherHandle)}`)}
                            className="w-full text-left flex items-center gap-3 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg px-2"
                        >
                            <Avatar name={it.otherHandle} src={getAvatarForHandle(it.otherHandle)} size="sm" />
                            <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{it.otherHandle}</div>
                                {it.lastMessage && (
                                    <div className="text-xs text-gray-500 truncate">
                                        {it.lastMessage.senderHandle === user.handle ? 'You: ' : ''}
                                        {it.lastMessage.text || (it.lastMessage.imageUrl ? 'Photo' : 'Message')}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {it.lastMessage && (
                                    <div className="text-[10px] text-gray-400">
                                        {new Date(it.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                )}
                                {it.unread > 0 && (
                                    <span className="min-w-[18px] h-[18px] px-1 bg-pink-500 text-white text-[10px] leading-[18px] rounded-full text-center">
                                        {it.unread > 9 ? '9+' : it.unread}
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}



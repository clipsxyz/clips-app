import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronLeft } from 'react-icons/fi';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { listConversations, seedMockDMs, type ConversationSummary } from '../api/messages';
import { getAvatarForHandle } from '../api/users';

export default function InboxPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [items, setItems] = React.useState<ConversationSummary[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!user?.handle) return;
        listConversations(user.handle).then(s => {
            setItems(s);
            setLoading(false);
        });
        const onUpdate = () => {
            listConversations(user!.handle!).then(setItems);
        };
        window.addEventListener('conversationUpdated', onUpdate as any);
        return () => window.removeEventListener('conversationUpdated', onUpdate as any);
    }, [user?.handle]);

    if (!user) {
        return <div className="p-6">Please sign in to view inbox.</div>;
    }

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
                <h1 className="text-xl font-semibold">Inbox</h1>
                <div className="flex-1" />
                {/* Dev-only: seed mock DMs */}
                <button
                    onClick={async () => {
                        if (!user?.handle) return;
                        await seedMockDMs(user.handle);
                        const s = await listConversations(user.handle);
                        setItems(s);
                    }}
                    className="px-3 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                    Add mock DMs
                </button>
            </div>
            {loading ? (
                <div className="text-gray-500">Loading…</div>
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



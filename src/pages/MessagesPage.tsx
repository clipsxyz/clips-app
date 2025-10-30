import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiChevronLeft, FiSend } from 'react-icons/fi';
import { IoMdPhotos } from 'react-icons/io';
import { BsEmojiSmile } from 'react-icons/bs';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { fetchPostsPage } from '../api/posts';
import { fetchConversation, appendMessage, type ChatMessage, markConversationRead } from '../api/messages';
import { getAvatarForHandle } from '../api/users';
import { isStoryMediaActive } from '../api/stories';

interface MessageUI extends ChatMessage {
    isFromMe: boolean;
    senderAvatar?: string;
}

export default function MessagesPage() {
    const navigate = useNavigate();
    const { handle } = useParams<{ handle: string }>();
    const { user } = useAuth();
    const [messages, setMessages] = useState<MessageUI[]>([]);
    const [storyActiveByUrl, setStoryActiveByUrl] = useState<Record<string, boolean>>({});
    const [messageText, setMessageText] = useState('');
    const [loading, setLoading] = useState(true);
    const [otherUserAvatar, setOtherUserAvatar] = useState<string | undefined>(undefined);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        async function loadAvatar() {
            if (!handle) return;

            // Fetch posts to find the user's avatar
            const allTabs = ['finglas', 'dublin', 'ireland', 'following'];
            for (const tab of allTabs) {
                try {
                    const page = await fetchPostsPage(tab, null, 100, user?.id || 'me', user?.local || '', user?.regional || '', user?.national || '');
                    const userPost = page.items.find(post => post.userHandle === handle);
                    if (userPost && userPost.userAvatarUrl) {
                        setOtherUserAvatar(userPost.userAvatarUrl);
                        return;
                    }
                } catch (error) {
                    console.error('Error fetching avatar:', error);
                }
            }

            // Mock avatar for Sarah@Artane
            if (handle === 'Sarah@Artane') {
                setOtherUserAvatar('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop');
            }
        }

        loadAvatar();

        // Load conversation from API
        if (!handle || !user?.handle) return;
        fetchConversation(user.handle, handle).then(items => {
            const mapped: MessageUI[] = items.map(m => ({
                ...m,
                isFromMe: m.senderHandle === user.handle,
                senderAvatar: m.senderHandle === user.handle ? (user.avatarUrl || getAvatarForHandle(user.handle)) : getAvatarForHandle(handle)
            }));
            setMessages(mapped);
            setLoading(false);
            // Mark as read on open
            markConversationRead(user.handle, handle).catch(() => { });
            const urls = Array.from(new Set(mapped.map(m => m.imageUrl).filter(Boolean) as string[]));
            Promise.all(urls.map(async (u) => [u, await isStoryMediaActive(u)] as const))
                .then(entries => setStoryActiveByUrl(Object.fromEntries(entries)));
        });

        // Live updates
        const onUpdate = (e: any) => {
            const participants: string[] = e.detail?.participants || [];
            if (!participants.includes(user?.handle || '') || !participants.includes(handle || '')) return;
            fetchConversation(user!.handle!, handle!).then(items => {
                const mapped = items.map(m => ({
                    ...m,
                    isFromMe: m.senderHandle === user!.handle,
                    senderAvatar: m.senderHandle === user!.handle ? (user!.avatarUrl || getAvatarForHandle(user!.handle)) : getAvatarForHandle(handle!)
                }));
                setMessages(mapped);
                const urls = Array.from(new Set(mapped.map(m => m.imageUrl).filter(Boolean) as string[]));
                Promise.all(urls.map(async (u) => [u, await isStoryMediaActive(u)] as const))
                    .then(entries => setStoryActiveByUrl(Object.fromEntries(entries)));
            });
        };
        window.addEventListener('conversationUpdated', onUpdate as any);
        return () => window.removeEventListener('conversationUpdated', onUpdate as any);
    }, [handle, user?.handle]);

    const handleSend = async () => {
        if (!messageText.trim()) return;
        if (!user?.handle || !handle) return;
        await appendMessage(user.handle, handle, { text: messageText });
        setMessageText('');
    };

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // For demo, create a data URL
        const reader = new FileReader();
        reader.onloadend = () => {
            const imageUrl = reader.result as string;
            if (!user?.handle || !handle) return;
            appendMessage(user.handle, handle, { imageUrl });
        };
        reader.readAsDataURL(file);
    };

    const formatTimestamp = (ts: number) => {
        const date = new Date(ts);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (daysDiff === 0) {
            return 'Today ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        } else if (daysDiff === 1) {
            return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        } else {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            return days[date.getDay()] + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        }
    };

    // (unused helper retained for future grouping but updated to numbers)
    const getUniqueTimestamps = () => {
        const uniqueTimes: string[] = [];
        let lastTime = '';
        messages.forEach((msg, idx) => {
            const time = formatTimestamp(msg.timestamp);
            if (time !== lastTime && idx > 0) {
                lastTime = new Date(messages[idx - 1].timestamp).toDateString();
            }
            const dateKey = new Date(msg.timestamp).toDateString();
            if (!uniqueTimes.includes(dateKey)) {
                uniqueTimes.push(dateKey);
            }
        });
        return uniqueTimes;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-black border-b border-gray-800 z-10">
                <div className="flex items-center px-4 py-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-900 rounded-full transition-colors"
                    >
                        <FiChevronLeft className="w-6 h-6" />
                    </button>
                    {handle && (
                        <div className="flex items-center ml-3 flex-1">
                            <Avatar
                                src={otherUserAvatar}
                                name={handle}
                                size="sm"
                            />
                            <div className="ml-3 flex-1">
                                <div className="flex items-center gap-1">
                                    <span className="font-medium">{handle}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
                <div className="space-y-3">
                    {messages.map((msg, idx) => {
                        const showTimestamp = idx === 0 ||
                            (messages[idx - 1].timestamp - msg.timestamp) > 60000; // Show timestamp if more than 1 minute gap

                        return (
                            <React.Fragment key={msg.id}>
                                {showTimestamp && msg.isSystemMessage && (
                                    <div className="text-center py-2">
                                        <span className="text-xs text-gray-400">{formatTimestamp(msg.timestamp)}</span>
                                    </div>
                                )}
                                {msg.isSystemMessage && (
                                    <div className="text-center">
                                        <p className="text-white text-sm">{msg.text}</p>
                                    </div>
                                )}
                                {!msg.isSystemMessage && (
                                    <div className={`flex ${msg.isFromMe ? 'justify-end' : 'justify-start'} ${showTimestamp ? 'mt-4' : ''}`}>
                                        {msg.isFromMe ? (
                                            <div className="bg-purple-600 rounded-2xl px-4 py-2 max-w-[70%] break-words">
                                                {msg.imageUrl && (
                                                    <div className="relative mb-2">
                                                        <img src={msg.imageUrl} alt="Sent image" className="max-w-full rounded-lg" />
                                                        {msg.imageUrl && storyActiveByUrl[msg.imageUrl] === false && (
                                                            <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                                                                <span className="text-[10px] text-white/90 px-2 py-1 rounded">Story unavailable</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {msg.text && <p className="text-white text-sm">{msg.text}</p>}
                                            </div>
                                        ) : (
                                            <div className="flex items-start gap-2 max-w-[70%]">
                                                {msg.senderAvatar && (
                                                    <Avatar
                                                        src={msg.senderAvatar}
                                                        name={msg.senderHandle}
                                                        size="xs"
                                                    />
                                                )}
                                                <div className="bg-gray-800 rounded-2xl px-4 py-2 break-words">
                                                    {msg.imageUrl && (
                                                        <div className="relative mb-2">
                                                            <img src={msg.imageUrl} alt="Received image" className="max-w-full rounded-lg" />
                                                            {msg.imageUrl && storyActiveByUrl[msg.imageUrl] === false && (
                                                                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                                                                    <span className="text-[10px] text-white/90 px-2 py-1 rounded">Story unavailable</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {msg.text && <p className="text-white text-sm">{msg.text}</p>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Input Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-3 z-20">
                <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-3">
                        <input
                            type="text"
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleSend();
                                }
                            }}
                            placeholder="Message..."
                            className="flex-1 bg-gray-800 text-white placeholder-gray-500 px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-600"
                        />
                        {messageText.trim() && (
                            <button
                                onClick={handleSend}
                                className="text-purple-600 hover:text-purple-500 transition-colors"
                            >
                                <FiSend className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {!messageText.trim() && (
                            <>
                                <button
                                    onClick={handleImageClick}
                                    className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                                >
                                    <IoMdPhotos className="w-6 h-6 text-gray-400" />
                                </button>
                                <button className="p-2 hover:bg-gray-800 rounded-full transition-colors">
                                    <BsEmojiSmile className="w-6 h-6 text-gray-400" />
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageChange}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}


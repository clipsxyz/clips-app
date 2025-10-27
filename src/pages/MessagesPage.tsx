import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiChevronLeft, FiSend } from 'react-icons/fi';
import { IoMdPhotos } from 'react-icons/io';
import { BsEmojiSmile } from 'react-icons/bs';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { fetchPostsPage } from '../api/posts';

interface Message {
    id: string;
    senderHandle: string;
    senderAvatar?: string;
    text: string;
    imageUrl?: string;
    timestamp: Date;
    isFromMe: boolean;
    isSystemMessage?: boolean;
}

export default function MessagesPage() {
    const navigate = useNavigate();
    const { handle } = useParams<{ handle: string }>();
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
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

        // Mock messages - in a real app, you'd fetch these from an API
        const mockMessages: Message[] = [
            {
                id: '1',
                senderHandle: 'system',
                text: 'You replied to their story',
                timestamp: new Date(Date.now() - 86400000),
                isFromMe: false,
                isSystemMessage: true
            },
            {
                id: '2',
                senderHandle: 'system',
                text: 'Story unavailable',
                timestamp: new Date(Date.now() - 86400000),
                isFromMe: false,
                isSystemMessage: true
            },
            {
                id: '3',
                senderHandle: user?.handle || 'me',
                text: 'Good to hear, very brave ... What happened??',
                timestamp: new Date(Date.now() - 86400000),
                isFromMe: true
            },
            {
                id: '4',
                senderHandle: 'system',
                text: 'You replied to their story',
                timestamp: new Date(Date.now() - 86400000),
                isFromMe: false,
                isSystemMessage: true
            },
            {
                id: '5',
                senderHandle: 'system',
                text: 'Story unavailable',
                timestamp: new Date(Date.now() - 86400000),
                isFromMe: false,
                isSystemMessage: true
            },
            {
                id: '6',
                senderHandle: user?.handle || 'me',
                text: 'Health or cosmetic?',
                timestamp: new Date(Date.now() - 86400000),
                isFromMe: true
            },
            {
                id: '7',
                senderHandle: handle || 'milania_stark',
                senderAvatar: 'https://i.pravatar.cc/150?img=5',
                text: 'Healt omg haha',
                timestamp: new Date(Date.now() - 86400000),
                isFromMe: false
            },
            {
                id: '8',
                senderHandle: user?.handle || 'me',
                text: 'Wasn\'t sure ... I just thought what could be wrong with perfection 🤔... But glad your on the other side now and hope 🙏 your ok soon',
                timestamp: new Date(Date.now() - 86400000),
                isFromMe: true
            },
            {
                id: '9',
                senderHandle: 'system',
                text: 'You replied to their story',
                timestamp: new Date(Date.now() - 2 * 86400000),
                isFromMe: false,
                isSystemMessage: true
            },
            {
                id: '10',
                senderHandle: 'system',
                text: 'Story unavailable',
                timestamp: new Date(Date.now() - 2 * 86400000),
                isFromMe: false,
                isSystemMessage: true
            },
            {
                id: '11',
                senderHandle: user?.handle || 'me',
                text: 'Your face is the best part ... Gorgeous 🥰',
                timestamp: new Date(Date.now() - 2 * 86400000),
                isFromMe: true
            },
        ];

        setMessages(mockMessages);
        setLoading(false);
    }, [handle, user?.handle]);

    const handleSend = () => {
        if (!messageText.trim()) return;

        const newMessage: Message = {
            id: Date.now().toString(),
            senderHandle: user?.handle || 'me',
            text: messageText,
            timestamp: new Date(),
            isFromMe: true
        };

        setMessages([newMessage, ...messages]);
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
            const newMessage: Message = {
                id: Date.now().toString(),
                senderHandle: user?.handle || 'me',
                text: '',
                imageUrl: imageUrl,
                timestamp: new Date(),
                isFromMe: true
            };

            setMessages([newMessage, ...messages]);
        };
        reader.readAsDataURL(file);
    };

    const formatTimestamp = (date: Date) => {
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

    const getUniqueTimestamps = () => {
        const uniqueTimes: string[] = [];
        let lastTime = '';
        messages.forEach((msg, idx) => {
            const time = formatTimestamp(msg.timestamp);
            if (time !== lastTime && idx > 0) {
                lastTime = messages[idx - 1].timestamp.toDateString();
            }
            const dateKey = msg.timestamp.toDateString();
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
                            messages[idx - 1].timestamp.getTime() - msg.timestamp.getTime() > 60000; // Show timestamp if more than 1 minute gap

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
                                                    <img src={msg.imageUrl} alt="Sent image" className="max-w-full rounded-lg mb-2" />
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
                                                        <img src={msg.imageUrl} alt="Received image" className="max-w-full rounded-lg mb-2" />
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


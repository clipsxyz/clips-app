import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiChevronLeft, FiMessageCircle, FiCornerUpLeft, FiSmile, FiUserPlus, FiX } from 'react-icons/fi';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { getAvatarForHandle } from '../api/users';
import { getNotifications, type Notification, markNotificationRead, markAllNotificationsRead, getUnreadNotificationCount, deleteNotification } from '../api/notifications';
import { getStoryInsightsForUser, type StoryInsight } from '../api/stories';
// Import questions API - using type-only import to avoid runtime issues
type Question = {
    id: string;
    storyId: string;
    questionPrompt: string;
    creatorHandle: string;
    responderUserId: string;
    responderHandle: string;
    answer: string;
    createdAt: number;
    repliedTo: boolean;
    replyStoryId?: string;
};
import { listConversations, seedMockDMs, type ConversationSummary } from '../api/messages';
import { timeAgo } from '../utils/timeAgo';
import Swal from 'sweetalert2';
import { acceptFollowRequest, denyFollowRequest, removeFollowRequest } from '../api/privacy';
import { getFollowedUsers } from '../api/posts';

export default function InboxPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [notifications, setNotifications] = React.useState<Notification[]>([]);
    const [insights, setInsights] = React.useState<StoryInsight[]>([]);
    const [items, setItems] = React.useState<ConversationSummary[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState<'insights' | 'notifications' | 'questions'>('notifications');
    const [selectedQuestionInsight, setSelectedQuestionInsight] = React.useState<StoryInsight | null>(null);
    const [questions, setQuestions] = React.useState<Question[]>([]);
    const [questionAvatars, setQuestionAvatars] = React.useState<Record<string, string>>({});

    const loadData = React.useCallback(async () => {
        if (!user?.handle) return;
        try {
            // Dynamically import to avoid circular dependency issues
            const { getQuestionsForUser } = await import('../api/questions');
            const [notifs, storyInsights, conversations, userQuestions] = await Promise.all([
                getNotifications(user.handle),
                getStoryInsightsForUser(user.handle),
                listConversations(user.handle),
                getQuestionsForUser(user.handle).catch(err => {
                    console.error('Error loading questions:', err);
                    return [];
                })
            ]);
            setNotifications(notifs);
            setInsights(storyInsights);
            setItems(conversations);
            setQuestions(userQuestions || []);
            
            // Fetch avatar URLs for question responders
            if (userQuestions && userQuestions.length > 0) {
                const avatarMap: Record<string, string> = {};
                await Promise.all(userQuestions.map(async (q) => {
                    // Try to get avatar from getAvatarForHandle first (for mock data)
                    let avatarUrl = getAvatarForHandle(q.responderHandle);
                    
                    // If not found in mock data, try fetching from backend API
                    if (!avatarUrl && user?.id) {
                        try {
                            const { fetchUserProfile } = await import('../api/client');
                            const profile = await fetchUserProfile(q.responderHandle, user.id);
                            if (profile && (profile.avatar_url || profile.avatarUrl)) {
                                avatarUrl = profile.avatar_url || profile.avatarUrl;
                            }
                        } catch (error) {
                            console.warn(`Failed to fetch avatar for ${q.responderHandle}:`, error);
                        }
                    }
                    
                    if (avatarUrl) {
                        avatarMap[q.responderHandle] = avatarUrl;
                    }
                }));
                setQuestionAvatars(avatarMap);
            }
            
            setLoading(false);
        } catch (error) {
            console.error('Error loading inbox data:', error);
            setNotifications([]);
            setInsights([]);
            setItems([]);
            setQuestions([]);
            setQuestionAvatars({});
            setLoading(false);
        }
    }, [user?.handle, user?.id]);

    React.useEffect(() => {
        if (!user?.handle) return;
        loadData();

        const onNotificationUpdate = () => {
            getNotifications(user!.handle!).then(setNotifications);
        };
        const onConversationUpdate = () => {
            listConversations(user!.handle!).then(setItems);
        };

        window.addEventListener('notificationsUpdated', onNotificationUpdate as any);
        window.addEventListener('conversationUpdated', onConversationUpdate as any);

        return () => {
            window.removeEventListener('notificationsUpdated', onNotificationUpdate as any);
            window.removeEventListener('conversationUpdated', onConversationUpdate as any);
        };
    }, [user?.handle, loadData]);

    if (!user) {
        return <div className="p-6">Please sign in to view notifications.</div>;
    }

    const unreadNotifications = notifications.filter(n => !n.read).length;

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
            case 'follow_request':
                return `wants to follow you`;
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
            case 'follow_request':
                return <FiUserPlus className="w-5 h-5 text-amber-500" />;
            default:
                return <FiMessageCircle className="w-5 h-5 text-gray-500" />;
        }
    };

    const handleAcceptFollowRequest = async (notif: Notification, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user?.handle || !user?.id) return;
        
        try {
            // Accept the follow request
            acceptFollowRequest(notif.fromHandle, user.handle);
            
            // Add to followed users (using the posts API state)
            const { toggleFollowForPost } = await import('../api/posts');
            const { posts } = await import('../api/posts');
            // Find a post by this user to toggle follow
            const userPost = posts.find(p => p.userHandle === notif.fromHandle);
            if (userPost) {
                await toggleFollowForPost(user.id, userPost.id);
            }
            
            await deleteNotification(notif.id, user.handle);
            await loadData();
            
            Swal.fire({
                title: 'Follow Request Accepted',
                text: `You are now following ${notif.fromHandle}`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Error accepting follow request:', error);
            Swal.fire({
                title: 'Error',
                text: 'Failed to accept follow request',
                icon: 'error'
            });
        }
    };

    const handleDenyFollowRequest = async (notif: Notification, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user?.handle) return;
        
        try {
            denyFollowRequest(notif.fromHandle, user.handle);
            await deleteNotification(notif.id, user.handle);
            await loadData();
        } catch (error) {
            console.error('Error denying follow request:', error);
            Swal.fire({
                title: 'Error',
                text: 'Failed to deny follow request',
                icon: 'error'
            });
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
                <button
                    onClick={async () => {
                        if (!user?.handle) return;
                        await seedMockDMs(user.handle);
                        // Reload conversations
                        const conversations = await listConversations(user.handle);
                        setItems(conversations);
                    }}
                    className="px-3 py-1.5 text-sm rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors"
                >
                    Add mock DMs
                </button>
            </div>

            {/* Tabs */}
            <div className="flex mb-4 border-b border-gray-800">
                <button
                    onClick={() => setActiveTab('notifications')}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors relative whitespace-nowrap flex items-center justify-center gap-1 ${activeTab === 'notifications'
                            ? 'text-green-500 border-b-2 border-green-500'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <span>Notifs</span>
                    {unreadNotifications > 0 && (
                        <span className="px-1 py-0.5 bg-green-500 text-white text-[9px] rounded-full min-w-[16px] text-center leading-none">
                            {unreadNotifications > 9 ? '9+' : unreadNotifications}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('insights')}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors relative whitespace-nowrap flex items-center justify-center gap-1 ${activeTab === 'insights'
                            ? 'text-purple-500 border-b-2 border-purple-500'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <span>Insights</span>
                    {insights && insights.length > 0 && (
                        <span className="px-1 py-0.5 bg-purple-500 text-white text-[9px] rounded-full min-w-[16px] text-center leading-none">
                            {insights.length > 9 ? '9+' : insights.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('questions')}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors relative whitespace-nowrap flex items-center justify-center gap-1 ${activeTab === 'questions'
                            ? 'text-red-500 border-b-2 border-red-500'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <span>Questions</span>
                    {questions && questions.length > 0 && (
                        <span className="px-1 py-0.5 bg-red-500 text-white text-[9px] rounded-full min-w-[16px] text-center leading-none">
                            {questions.length > 9 ? '9+' : questions.length}
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
                                    className="text-xs text-green-500 hover:text-green-400"
                                >
                                    Mark all as read
                                </button>
                            </div>
                        )}
                        {notifications.map(notif => (
                            <div
                                key={notif.id}
                                className={`w-full text-left flex items-center gap-3 py-3 px-2 rounded-lg transition-colors ${notif.read
                                        ? 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                        : 'bg-green-900/20 hover:bg-green-900/30 border-l-4 border-green-500'
                                    }`}
                            >
                                <button
                                    onClick={() => handleNotificationClick(notif)}
                                    className="flex items-center gap-3 flex-1 min-w-0"
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
                                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                        )}
                                    </div>
                                </button>
                                {notif.type === 'follow_request' && (
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button
                                            onClick={(e) => handleAcceptFollowRequest(notif, e)}
                                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium transition-colors"
                                        >
                                            Accept
                                        </button>
                                        <button
                                            onClick={(e) => handleDenyFollowRequest(notif, e)}
                                            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg font-medium transition-colors"
                                        >
                                            Deny
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )
            ) : activeTab === 'questions' ? (
                !questions || !Array.isArray(questions) || questions.length === 0 ? (
                    <div className="text-gray-500">No questions yet.</div>
                ) : (
                    <div className="space-y-3">
                        {questions.map(question => (
                            <div
                                key={question.id}
                                className="w-full text-left bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
                            >
                                <div className="flex items-start gap-3 mb-3">
                                    <Avatar
                                        name={question.responderHandle}
                                        src={questionAvatars[question.responderHandle] || getAvatarForHandle(question.responderHandle)}
                                        size="sm"
                                    />
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                            {question.responderHandle}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {timeAgo(question.createdAt)}
                                        </p>
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-semibold uppercase tracking-wide">Question:</p>
                                    <p className="text-sm text-gray-900 dark:text-gray-100 font-semibold">{question.questionPrompt}</p>
                                </div>
                                <div className="mb-4">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-semibold uppercase tracking-wide">Reply:</p>
                                    <p className="text-sm text-gray-900 dark:text-gray-100">{question.answer}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        navigate('/reply-question', {
                                            state: {
                                                replyToQuestion: {
                                                    question: question.questionPrompt,
                                                    response: question.answer,
                                                    responderHandle: question.responderHandle,
                                                    questionId: question.id
                                                }
                                            }
                                        });
                                    }}
                                    className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:opacity-90 transition-opacity"
                                >
                                    Reply in Story
                                </button>
                            </div>
                        ))}
                    </div>
                )
            ) : activeTab === 'insights' ? (
                !insights || insights.length === 0 ? (
                    <div className="text-gray-500">No story insights yet.</div>
                ) : (
                <div className="space-y-2">
                    {insights.map(insight => (
                        <div
                            key={insight.storyId}
                            onClick={() => {
                                if (insight.question && insight.question.responseCount > 0) {
                                    setSelectedQuestionInsight(insight);
                                }
                            }}
                            className={`w-full text-left flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ${insight.question && insight.question.responseCount > 0 ? 'cursor-pointer' : ''}`}
                        >
                            {/* Show avatar from first responder if question, otherwise from first liker */}
                            {insight.question && insight.question.responses && insight.question.responses.length > 0 ? (
                                <Avatar
                                    name={insight.question.responses[0].userHandle}
                                    src={getAvatarForHandle(insight.question.responses[0].userHandle)}
                                    size="sm"
                                />
                            ) : insight.likes > 0 && insight.likers && insight.likers.length > 0 ? (
                                <Avatar
                                    name={insight.likers[0]}
                                    src={getAvatarForHandle(insight.likers[0])}
                                    size="sm"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                    {insight.question 
                                        ? `Q: ${insight.question.prompt.length > 30 ? insight.question.prompt.slice(0, 30) + '…' : insight.question.prompt}`
                                        : insight.text 
                                        ? (insight.text.length > 40 ? insight.text.slice(0, 40) + '…' : insight.text) 
                                        : 'Story'}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                    {insight.question && insight.question.responseCount > 0 ? (
                                        insight.question.responseCount === 1
                                            ? `1 answer`
                                            : `${insight.question.responseCount} answers`
                                    ) : insight.likes === 0
                                        ? 'No likes yet'
                                        : !insight.likers || insight.likers.length === 0
                                        ? 'No likes yet'
                                        : insight.likes === 1
                                        ? `Liked by ${insight.likers[0]}`
                                        : insight.likes === 2
                                        ? `Liked by ${insight.likers.join(' and ')}`
                                        : `Liked by ${insight.likers.slice(0, 2).join(', ')} and ${insight.likes - 2} others`}
                                </div>
                            </div>
                            <div className="text-[10px] text-gray-400">
                                {new Date(insight.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    ))}
                </div>
            )
            ) : null}

            {/* Question Responses Modal */}
            {selectedQuestionInsight && selectedQuestionInsight.question && (
                <div 
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setSelectedQuestionInsight(null)}
                >
                    <div 
                        className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                Question Responses
                            </h2>
                            <button
                                onClick={() => setSelectedQuestionInsight(null)}
                                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <FiX className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                            </button>
                        </div>
                        
                        {/* Question Prompt */}
                        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-4 mb-4 text-center">
                            <p className="text-white font-semibold">{selectedQuestionInsight.question.prompt}</p>
                        </div>

                        {/* Responses List */}
                        <div className="flex-1 overflow-y-auto space-y-3">
                            {selectedQuestionInsight.question.responses && selectedQuestionInsight.question.responses.length > 0 ? (
                                selectedQuestionInsight.question.responses.map((response) => (
                                    <div
                                        key={response.id}
                                        className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <Avatar
                                                name={response.userHandle}
                                                src={getAvatarForHandle(response.userHandle)}
                                                size="sm"
                                            />
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                                    {response.userHandle}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {timeAgo(response.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-gray-900 dark:text-gray-100 text-sm">
                                            {response.text}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-gray-500 py-8">
                                    No responses yet
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}



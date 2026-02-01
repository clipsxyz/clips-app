import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { FiChevronLeft, FiSend, FiCornerUpLeft, FiMoreHorizontal, FiMapPin, FiEdit3, FiX, FiMic, FiUserPlus, FiPlus, FiCheck } from 'react-icons/fi';
import { IoMdPhotos } from 'react-icons/io';
import { BsEmojiSmile } from 'react-icons/bs';
import { FaPaperPlane, FaExclamationCircle } from 'react-icons/fa';
import { MdStickyNote2, MdTranslate } from 'react-icons/md';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { fetchConversation, appendMessage, editMessage, type ChatMessage, markConversationRead, deleteConversation, blockUser, muteConversation, unmuteConversation, isConversationMuted } from '../api/messages';
import { getAvatarForHandle, getFlagForHandle } from '../api/users';
import { isStoryMediaActive, wasEverAStory, userHasUnviewedStoriesByHandle, userHasStoriesByHandle } from '../api/stories';
import { getPostById, getFollowedUsers, getState, toggleLike } from '../api/posts';
import { toggleFollow, fetchUserProfile } from '../api/client';
import ScenesModal from '../components/ScenesModal';
import type { Post } from '../types';
import Flag from '../components/Flag';
import { timeAgo } from '../utils/timeAgo';
import { showToast } from '../utils/toast';
import { getSocket } from '../services/socketio';
import Swal from 'sweetalert2';

interface MessageUI extends ChatMessage {
    isFromMe: boolean;
    senderAvatar?: string;
    reactions?: { emoji: string; users: string[] }[];
    replyTo?: { messageId: string; text: string; senderHandle: string; imageUrl?: string; mediaType?: 'image' | 'video' };
    edited?: boolean;
    read?: boolean;
}

// Helper to parse places from a bio string.
// Matches the behavior on the profile page so "places in my bio"
// are treated as traveled locations.
function parsePlacesFromBio(bio: string): string[] {
    if (!bio || typeof bio !== 'string') return [];
    const parts = bio
        .split(/[,;\n.]|\s+and\s+|\s*[-–—]\s*|:\s*/i)
        .map((p) => p.trim())
        .filter((p) => p.length >= 2);
    if (parts.length === 0 && bio.trim().length >= 2) return [bio.trim()];
    return [...new Set(parts)];
}

// Helper function to parse question messages
function parseQuestionMessage(text: string | undefined): { question: string; answer: string } | null {
    if (!text || !text.startsWith('QUESTION:')) return null;
    const match = text.match(/QUESTION:(.+?)\|ANSWER:(.+)/);
    if (match) {
        return {
            question: match[1],
            answer: match[2]
        };
    }
    return null;
}

// Helper function to extract post ID from message text
function extractPostId(text: string): string | null {
    if (!text) return null;
    
    // Log the full text for debugging
    console.log('Extracting post ID from text:', text);
    
    // Post IDs can be in multiple formats:
    // 1. UUID-timestamp: "550e8400-e29b-41d4-a716-446655440000-1234567890123"
    // 2. Old format: "post-1-0-1763047647804-z58tl94lh"
    // 3. Artane format: "artane-post-1-1763047647805-ta19qa03v"
    // 4. Reclip format: "reclip-userId-originalPostId-timestamp"
    
    // Pattern 1: Full URL like http://localhost:5173/post/{postId}
    // Matches any post ID format after /post/
    const fullUrlPattern = /https?:\/\/[^\s\/]+\/post\/([^\s\/\?&#]+?)(?:\/|\?|#|$)/i;
    let match = text.match(fullUrlPattern);
    if (match && match[1]) {
        console.log('✓ Extracted post ID (full URL):', match[1]);
        return match[1];
    }
    
    // Pattern 2: Path like /post/{postId} or post/{postId}
    const pathPattern = /\/?post\/([^\s\/\?&#]+?)(?:\/|\?|#|$|\s)/i;
    match = text.match(pathPattern);
    if (match && match[1]) {
        console.log('✓ Extracted post ID (path):', match[1]);
        return match[1];
    }
    
    // Pattern 3: Standalone UUID-timestamp format (new posts)
    // Matches: UUID (36 chars with hyphens) + dash + timestamp (one or more digits)
    const uuidTimestampPattern = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-\d+)/i;
    match = text.match(uuidTimestampPattern);
    if (match && match[1]) {
        console.log('✓ Extracted post ID (UUID-timestamp):', match[1]);
        return match[1];
    }
    
    // Pattern 4: Old format: "post-{id}-{index}-{timestamp}-{random}"
    const oldFormatPattern = /(post-\d+-\d+-\d+-[a-z0-9]+)/i;
    match = text.match(oldFormatPattern);
    if (match && match[1]) {
        console.log('✓ Extracted post ID (old format):', match[1]);
        return match[1];
    }
    
    // Pattern 5: Artane format: "artane-post-{number}-{timestamp}-{random}"
    const artaneFormatPattern = /(artane-post-\d+-\d+-[a-z0-9]+)/i;
    match = text.match(artaneFormatPattern);
    if (match && match[1]) {
        console.log('✓ Extracted post ID (artane format):', match[1]);
        return match[1];
    }
    
    // Pattern 6: Reclip format: "reclip-{userId}-{originalPostId}-{timestamp}"
    const reclipFormatPattern = /(reclip-[^-]+-[^-]+-\d+)/i;
    match = text.match(reclipFormatPattern);
    if (match && match[1]) {
        console.log('✓ Extracted post ID (reclip format):', match[1]);
        return match[1];
    }
    
    // Pattern 7: Just UUID (36 chars with hyphens) - fallback for old format
    const uuidPattern = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?![-\d])/i;
    match = text.match(uuidPattern);
    if (match && match[1]) {
        console.log('✓ Extracted post ID (UUID only, fallback):', match[1]);
        return match[1];
    }
    
    console.log('✗ No post ID found in text. Full text:', text);
    console.log('✗ Tried patterns: full URL, path, UUID-timestamp, old format, artane format, reclip format, UUID only');
    return null;
}


// Component to render comment notification with post preview (Twitter/X style)
function CommentCard({ post, commentText, commenterHandle }: { post: Post; commentText: string; commenterHandle: string }) {
    const hasMediaUrl = post.mediaUrl && post.mediaUrl.trim() !== '';
    const hasMediaItems = post.mediaItems && post.mediaItems.length > 0;
    const hasMedia = hasMediaUrl || hasMediaItems;
    
    return (
        <div 
            className="w-full max-w-md rounded-2xl overflow-hidden border shadow-xl"
            style={{
                backgroundColor: '#ffffff', // Force white background
                borderColor: '#e5e7eb' // Light gray border
            }}
        >
            {/* Comment Header */}
            <div className="px-4 pt-4 pb-2" style={{ backgroundColor: '#ffffff' }}>
                <div className="flex items-center gap-2 mb-2">
                    <Avatar
                        src={getAvatarForHandle(commenterHandle)}
                        name={commenterHandle.split('@')[0]}
                        size="sm"
                    />
                    <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm" style={{ color: '#111827' }}>{commenterHandle}</span>
                            <Flag
                                value={getFlagForHandle(commenterHandle) || ''}
                                size={12}
                            />
                            <span className="text-xs" style={{ color: '#6b7280' }}>commented</span>
                        </div>
                    </div>
                </div>
                {/* Comment Text */}
                <p className="text-sm mb-3 pl-11" style={{ color: '#111827' }}>{commentText}</p>
            </div>
            
            {/* Post Preview */}
            <div 
                className="border-t px-4 py-3"
                style={{
                    borderColor: '#e5e7eb',
                    backgroundColor: '#f9fafb' // Light gray background for preview section
                }}
            >
                <div className="flex items-start gap-3">
                    <Avatar
                        src={getAvatarForHandle(post.userHandle)}
                        name={post.userHandle.split('@')[0]}
                        size="sm"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="font-semibold text-xs" style={{ color: '#111827' }}>{post.userHandle}</span>
                            <Flag
                                value={getFlagForHandle(post.userHandle) || ''}
                                size={10}
                            />
                        </div>
                        {post.text && (
                            <p className="text-xs line-clamp-2 mb-2" style={{ color: '#4b5563' }}>{post.text}</p>
                        )}
                        {hasMedia && (
                            <div className="rounded-lg overflow-hidden border" style={{ borderColor: '#e5e7eb' }}>
                                {hasMediaUrl && (
                                    post.mediaType === 'video' ? (
                                        <div className="relative">
                                            <video 
                                                src={post.mediaUrl} 
                                                className="w-full h-32 object-cover" 
                                                muted
                                                playsInline
                                            />
                                            <div className="absolute top-2 right-2 bg-black/50 rounded px-1.5 py-0.5">
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                                </svg>
                                            </div>
                                        </div>
                                    ) : (
                                        <img src={post.mediaUrl} alt="Post media" className="w-full h-32 object-cover" />
                                    )
                                )}
                                {hasMediaItems && !hasMediaUrl && post.mediaItems && post.mediaItems[0] && (
                                    post.mediaItems[0].type === 'video' ? (
                                        <div className="relative">
                                            <video 
                                                src={post.mediaItems[0].url} 
                                                className="w-full h-32 object-cover" 
                                                muted
                                                playsInline
                                            />
                                            <div className="absolute top-2 right-2 bg-black/50 rounded px-1.5 py-0.5">
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                                </svg>
                                            </div>
                                        </div>
                                    ) : (
                                        <img src={post.mediaItems[0].url} alt="Post media" className="w-full h-32 object-cover" />
                                    )
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Compact preview when post is not yet loaded: fetch to show MP4/image thumbnail, tap to view in Scenes
function SharedPostPreviewCard({ postId, onTap, userId }: { postId: string; onTap: () => void; userId?: string }) {
    const [previewPost, setPreviewPost] = useState<Post | null>(null);
    React.useEffect(() => {
        let cancelled = false;
        getPostById(postId, userId).then(post => {
            if (!cancelled && post) setPreviewPost(post);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [postId, userId]);

    // Media can be in mediaUrl OR in mediaItems (still-image posts often only have media_items)
    const firstMediaItem = previewPost?.mediaItems?.[0];
    const firstItemUrl = firstMediaItem && (firstMediaItem.url ?? (firstMediaItem as { media_url?: string }).media_url);
    const displayUrl = (previewPost?.mediaUrl?.trim() || (typeof firstItemUrl === 'string' && firstItemUrl.trim()) || '').trim() || '';
    const hasMedia = displayUrl.length > 0;
    const isVideo = previewPost?.mediaType === 'video' || firstMediaItem?.type === 'video';

    return (
        <button
            type="button"
            onClick={onTap}
            aria-label="View post in Scenes"
            data-post-id={postId}
            className="w-full max-w-md rounded-2xl overflow-hidden bg-gray-800 border border-gray-600 shadow-lg flex flex-col hover:bg-gray-750 active:opacity-90 transition-opacity min-h-[100px]"
        >
            {hasMedia ? (
                <div className="w-full flex flex-col">
                    <div className="relative w-full aspect-video bg-black">
                        {isVideo ? (
                            <video
                                src={displayUrl}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                                disablePictureInPicture
                            />
                        ) : (
                            <img src={displayUrl} alt="" className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path d="M8 5v14l11-7L8 5z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div className="w-full bg-sky-600 px-3 py-3 flex items-center justify-center border-t-2 border-sky-500">
                        <span className="text-white text-base font-bold">Tap to view in Scenes</span>
                    </div>
                </div>
            ) : (
                <div className="p-6 flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path d="M8 5v14l11-7L8 5z" />
                        </svg>
                    </div>
                    <span className="text-white text-base font-semibold">Tap to view in Scenes</span>
                </div>
            )}
        </button>
    );
}

// Component to render shared post card (matching ScenesModal format exactly - Twitter card style)
function SharedPostCard({ post, onTap }: { post: Post; onTap?: (post: Post) => void }) {
    // Derive display URL from mediaUrl or first mediaItems item (still-image posts often only have media_items)
    const firstMediaItem = post.mediaItems?.[0];
    const firstItemUrl = firstMediaItem && (firstMediaItem.url ?? (firstMediaItem as { media_url?: string }).media_url);
    const displayMediaUrlForCheck = (post.mediaUrl?.trim() || (typeof firstItemUrl === 'string' && firstItemUrl.trim()) || '').trim() || '';
    const hasDisplayMedia = displayMediaUrlForCheck.length > 0;
    // Text-only = has text and no media to display (still images and video both count as media)
    const isTextOnly = !!post.text && !hasDisplayMedia;
    
    const cardContent = (() => {
    // Always show text-only posts as white Twitter card (matching ScenesModal)
    // Force white background regardless of dark mode - use !important via inline styles
    if (isTextOnly) {
        // Match ScenesModal EXACTLY - copy the exact same structure and classes
        // This is the Twitter card style: white card with black text box
        return (
            <div 
                className="w-full max-w-md rounded-2xl overflow-hidden border shadow-2xl"
                style={{ 
                    maxWidth: '100%', 
                    boxSizing: 'border-box',
                    backgroundColor: '#ffffff', // Force white background
                    borderColor: '#e5e7eb', // Light gray border
                    display: 'block',
                    visibility: 'visible',
                    opacity: 1,
                    color: '#000000', // Force black text for header
                    background: '#ffffff' // Double-set to override dark mode
                }}
            >
                {/* Post Header - exactly like ScenesModal */}
                <div 
                    className="flex items-start justify-between px-4 pt-4 pb-3 border-b" 
                    style={{ 
                        backgroundColor: '#ffffff',
                        borderColor: '#e5e7eb' // Light gray border
                    }}
                >
                    <div className="flex items-center gap-3 flex-1">
                        <Avatar
                            src={getAvatarForHandle(post.userHandle)}
                            name={post.userHandle.split('@')[0]}
                            size="sm"
                        />
                        <div className="flex-1">
                            <h3 className="font-semibold flex items-center gap-1.5 text-sm" style={{ color: '#111827' }}>
                                <span>{post.userHandle}</span>
                                <Flag
                                    value={getFlagForHandle(post.userHandle) || ''}
                                    size={14}
                                />
                            </h3>
                            <div className="text-xs flex items-center gap-2 mt-0.5" style={{ color: '#4b5563' }}>
                                {post.locationLabel && (
                                    <>
                                        <span className="flex items-center gap-1">
                                            <FiMapPin className="w-3 h-3" />
                                            {post.locationLabel}
                                        </span>
                                        {post.createdAt && <span style={{ color: '#9ca3af' }}>·</span>}
                                    </>
                                )}
                                {post.createdAt && (
                                    <span>{timeAgo(post.createdAt)}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Text Content - styled exactly like ScenesModal - white card with black text box */}
                <div 
                    className="p-4 w-full overflow-hidden" 
                    style={{ 
                        maxWidth: '100%', 
                        boxSizing: 'border-box', 
                        backgroundColor: '#ffffff' // White background
                    }}
                >
                    <div 
                        className="p-4 rounded-lg overflow-hidden w-full" 
                        style={{ 
                            maxWidth: '100%', 
                            boxSizing: 'border-box', 
                            backgroundColor: '#000000' // Black box for text
                        }}
                    >
                        <div 
                            className="text-base leading-relaxed whitespace-pre-wrap font-normal break-words w-full" 
                            style={{ 
                                wordBreak: 'break-word', 
                                overflowWrap: 'anywhere', 
                                maxWidth: '100%', 
                                boxSizing: 'border-box', 
                                color: '#ffffff' // White text in black box
                            }}
                        >
                            {post.text}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    // For posts with media, show a simple preview (video = static frame, tap opens Scenes)
    const isVideo = post.mediaType === 'video' || firstMediaItem?.type === 'video';
    return (
        <div 
            className="w-full max-w-sm rounded-2xl overflow-hidden border shadow-lg mt-2"
            style={{
                backgroundColor: '#ffffff',
                borderColor: '#e5e7eb'
            }}
        >
            <div className="p-4" style={{ backgroundColor: '#ffffff' }}>
                <div className="flex items-center gap-2 mb-2">
                    <Avatar
                        src={getAvatarForHandle(post.userHandle)}
                        name={post.userHandle.split('@')[0]}
                        size="sm"
                    />
                    <span className="font-semibold text-sm" style={{ color: '#111827' }}>{post.userHandle}</span>
                </div>
                {post.text && (
                    <p className="text-sm line-clamp-2" style={{ color: '#374151' }}>{post.text}</p>
                )}
                {displayMediaUrlForCheck && (
                    <div className="mt-2 rounded-lg overflow-hidden bg-black">
                        {isVideo ? (
                            <video
                                src={displayMediaUrlForCheck}
                                className="w-full h-auto max-h-48 object-cover"
                                muted
                                playsInline
                                preload="metadata"
                                disablePictureInPicture
                            />
                        ) : (
                            <img src={displayMediaUrlForCheck} alt="Post media" className="w-full h-auto max-h-48 object-cover" />
                        )}
                    </div>
                )}
            </div>
            {onTap && (
                <div className="w-full bg-sky-600 px-3 py-2.5 flex items-center justify-center border-t border-sky-500 rounded-b-2xl">
                    <span className="text-white text-sm font-bold">Tap to view in Scenes</span>
                </div>
            )}
        </div>
    );
    })();

    if (onTap) {
        return (
            <button type="button" onClick={() => onTap(post)} className="w-full block text-left rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                {cardContent}
            </button>
        );
    }
    return cardContent;
}

export default function MessagesPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { handle } = useParams<{ handle: string }>();
    const { user } = useAuth();
    const [messages, setMessages] = useState<MessageUI[]>([]);
    const [storyActiveByUrl, setStoryActiveByUrl] = useState<Record<string, boolean>>({});
    const [messageText, setMessageText] = useState('');
    
    // Store sharePostId from location.state (only used if we don't direct-send)
    const [pendingSharePostId, setPendingSharePostId] = React.useState<string | null>(null);
    const sharedPostSentRef = React.useRef(false);

    // Direct share to DM (Instagram/TikTok style): send the post immediately when opening the conversation
    React.useEffect(() => {
        const state = location.state as { sharePostUrl?: string; sharePostId?: string } | null;
        if (!state?.sharePostUrl || !handle || !user?.handle) return;
        if (sharedPostSentRef.current) return;

        sharedPostSentRef.current = true;

        (async () => {
            try {
                await appendMessage(user.handle!, handle, {
                    text: state.sharePostUrl!,
                    postId: state.sharePostId ?? undefined
                });
                // Refresh conversation so the new message appears in the feed
                const items = await fetchConversation(user.handle!, handle);
                const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);
                const mapped: MessageUI[] = sorted.map(m => ({
                    ...m,
                    isFromMe: m.senderHandle === user.handle,
                    senderAvatar: m.senderHandle === user.handle ? (user.avatarUrl || getAvatarForHandle(user.handle!)) : getAvatarForHandle(handle),
                    replyTo: m.replyTo
                }));
                setMessages(mapped);
                if (state.sharePostId) {
                    try {
                        const post = await getPostById(state.sharePostId, user?.id);
                        if (post) setSharedPosts(prev => ({ ...prev, [state.sharePostId!]: post }));
                    } catch (_) { /* ignore */ }
                }
                // Clear state so placeholder doesn't show and effect won't re-run
                navigate(location.pathname, { replace: true, state: {} });
                const shortHandle = handle.includes('@') ? handle : `@${handle}`;
                showToast?.(`Shared with ${shortHandle}`);
                setTimeout(scrollToBottom, 100);
            } catch (e: any) {
                console.error('Direct share failed:', e);
                sharedPostSentRef.current = false;
                const msg = e?.response?.message ?? e?.message ?? 'Failed to share. You can paste the link and send.';
                showToast?.(typeof msg === 'string' ? msg : 'Failed to share. You can paste the link and send.');
                setMessageText(state.sharePostUrl!);
                if (state.sharePostId) setPendingSharePostId(state.sharePostId);
            }
        })();
    }, [location.state, handle, user?.handle, location.pathname, navigate]);
    const [loading, setLoading] = useState(true);
    const [otherUserAvatar, setOtherUserAvatar] = useState<string | undefined>(undefined);
    const [hasUnviewedStories, setHasUnviewedStories] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [isFollowLoading, setIsFollowLoading] = useState(false);
    const [hasStories, setHasStories] = useState(false);
    const [showFollowCheck, setShowFollowCheck] = useState(false);
    const [sharedPosts, setSharedPosts] = useState<Record<string, Post>>({});
    const [otherUserPlacesTraveled, setOtherUserPlacesTraveled] = useState<string[] | undefined>(undefined);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        message: MessageUI | null;
        x: number;
        y: number;
    } | null>(null);
    const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sticker picker state (when opened from long-press "Add sticker", we capture this message as screenshot and put sticker on it)
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [messageForSticker, setMessageForSticker] = useState<MessageUI | null>(null);
    const messageForStickerRef = React.useRef<MessageUI | null>(null);
    
    // Message reactions state (messageId -> { emoji: string, users: string[] }[])
    const [messageReactions, setMessageReactions] = useState<Record<string, { emoji: string; users: string[] }[]>>({});
    // Sticker reaction animation: pop big then fly to card
    const [stickerReactionAnimation, setStickerReactionAnimation] = useState<{
        messageId: string;
        emoji: string;
        phase: 'pop' | 'fly';
        targetRect?: { left: number; top: number; width: number; height: number };
    } | null>(null);
    
    // Reply state
    const [replyingTo, setReplyingTo] = useState<MessageUI | null>(null);
    
    // Forward state
    const [forwardingMessage, setForwardingMessage] = useState<MessageUI | null>(null);
    const [availableConversations, setAvailableConversations] = useState<Array<{ otherHandle: string; lastMessage?: ChatMessage }>>([]);
    
    // Translation state
    const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
    
    // Report state
    const [reportingMessage, setReportingMessage] = useState<MessageUI | null>(null);
    const [reportReason, setReportReason] = useState<string>('');
    
    // Chat info modal state
    const [showChatInfo, setShowChatInfo] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    
    // Edit state
    const [editingMessage, setEditingMessage] = useState<MessageUI | null>(null);
    
    // Typing indicator
    const [isTyping, setIsTyping] = useState(false);
    
    // Voice message state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const audioChunksRef = React.useRef<Blob[]>([]);
    const recordingTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    
    // Vanish mode state
    const [vanishMode, setVanishMode] = useState(false);
    
    // Image compose: after picking an image, user can add caption before sending
    const [imageCompose, setImageCompose] = useState<{ imageUrl: string; caption: string } | null>(null);
    // Scenes modal: tap shared post in DM to open fullscreen, close returns to DM
    const [scenesOpen, setScenesOpen] = useState(false);
    const [selectedPostForScenes, setSelectedPostForScenes] = useState<Post | null>(null);

    const openScenesForPost = (post: Post) => {
        setSelectedPostForScenes(post);
        setScenesOpen(true);
    };
    const openScenesForPostId = (postId: string) => {
        getPostById(postId, user?.id).then(post => {
            if (post) {
                setSharedPosts(prev => ({ ...prev, [postId]: post }));
                setSelectedPostForScenes(post);
                setScenesOpen(true);
            } else {
                showToast?.('Could not load post');
            }
        }).catch(() => showToast?.('Could not load post'));
    };
    
    // Start voice recording
    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                // Convert to data URL for storage (in production, upload to server and get URL)
                const reader = new FileReader();
                reader.onloadend = async () => {
                    const base64Audio = reader.result as string;
                    if (user?.handle && handle) {
                        await appendMessage(user.handle, handle, {
                            text: `🎤 Voice Message`,
                            audioUrl: base64Audio // Use audioUrl field for voice messages
                        });
                        scrollToBottom();
                    }
                };
                reader.readAsDataURL(audioBlob);
                
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            
            // Start timer
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Error starting recording:', error);
            showToast?.('Failed to start recording. Please check microphone permissions.');
        }
    };
    
    // Stop voice recording
    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }
            setRecordingTime(0);
        }
    };

    const scrollToBottom = React.useCallback(() => {
        const el = listRef.current;
        if (!el) return;

        // Multiple attempts to ensure scroll happens
        const scroll = () => {
            if (el) {
                el.scrollTop = el.scrollHeight;
            }
        };

        // Try immediately
        scroll();

        // Try after requestAnimationFrame
        requestAnimationFrame(() => {
            scroll();
            // Try again after a small delay to ensure DOM is fully updated
            setTimeout(() => {
                scroll();
            }, 100);
        });
    }, []);

    // Track the last message ID to detect new messages (more reliable than count)
    const lastMessageIdRef = React.useRef<string | null>(null);
    const lastMessageCountRef = React.useRef<number>(0);
    const lastMessageRef = React.useRef<HTMLDivElement | null>(null);
    const isSendingMessageRef = React.useRef<boolean>(false); // Track if we're currently sending a message

    // Auto-scroll to bottom whenever messages change
    // Use useLayoutEffect for immediate DOM updates
    React.useLayoutEffect(() => {
        if (messages.length > 0 && !loading) {
            const currentCount = messages.length;
            const lastMessage = messages[messages.length - 1];
            const currentLastId = lastMessage?.id || null;

            // Scroll if message count changed OR if the last message ID changed (new message added)
            const countChanged = currentCount !== lastMessageCountRef.current;
            const lastIdChanged = currentLastId !== lastMessageIdRef.current;

            // Skip auto-scroll if we're in the middle of sending our own message (to prevent jerking)
            // Only scroll if it's a new message from someone else, or if we're not currently sending
            const shouldScroll = (countChanged || lastIdChanged) && !isSendingMessageRef.current;

            if (shouldScroll) {
                lastMessageCountRef.current = currentCount;
                lastMessageIdRef.current = currentLastId;

                // Simple, smooth scroll to bottom - single attempt to prevent jerking
                requestAnimationFrame(() => {
                    const el = listRef.current;
                    if (!el) return;

                    const lastMsgEl = lastMessageRef.current;
                    if (lastMsgEl) {
                        // Use scrollIntoView for smooth, reliable scrolling
                        lastMsgEl.scrollIntoView({
                            behavior: 'smooth',
                            block: 'end',
                            inline: 'nearest'
                        });
                    } else {
                        // Fallback to scrollTop if no message element
                        el.scrollTop = el.scrollHeight;
                    }
                });
            }
        }
    }, [messages, loading]);

    // Also use MutationObserver to detect DOM changes and scroll
    React.useEffect(() => {
        const el = listRef.current;
        if (!el) return;

        const observer = new MutationObserver(() => {
            // Skip if we're currently sending a message (to prevent jerking)
            if (isSendingMessageRef.current) return;
            
            // When DOM changes, check if we need to scroll
            const scrollHeight = el.scrollHeight;
            const scrollTop = el.scrollTop;
            const clientHeight = el.clientHeight;
            const maxScroll = scrollHeight - clientHeight;

            // Only auto-scroll if user is already near the bottom (within 100px)
            // This prevents interrupting user scrolling but catches new messages
            const isNearBottom = Math.abs(scrollTop - maxScroll) < 100;

            if (isNearBottom && maxScroll > 0) {
                requestAnimationFrame(() => {
                    el.scrollTop = scrollHeight;
                    // Also try scrollIntoView on last message
                    const lastMsgEl = lastMessageRef.current;
                    if (lastMsgEl) {
                        const inputBar = document.querySelector('.fixed.bottom-0.bg-gray-900');
                        const inputBarHeight = inputBar ? inputBar.getBoundingClientRect().height : 80;
                        requestAnimationFrame(() => {
                            const lastMsgRect = lastMsgEl.getBoundingClientRect();
                            const viewportHeight = window.innerHeight;
                            const inputBarTop = viewportHeight - inputBarHeight;

                            // Calculate exact scroll position to place message above input bar
                            const containerRect = el.getBoundingClientRect();

                            // Calculate message position relative to container
                            const messageTopRelative = lastMsgRect.top - containerRect.top + el.scrollTop;
                            const messageBottomRelative = messageTopRelative + lastMsgRect.height;

                            // Calculate visible container height (above input bar)
                            const visibleContainerHeight = inputBarTop - containerRect.top;
                            const padding = 150; // Extra padding above input bar to ensure full visibility (increased significantly)
                            const targetMessageBottom = visibleContainerHeight - padding;

                            // Calculate the exact scroll position needed
                            const targetScrollTop = messageBottomRelative - targetMessageBottom;

                            // Always scroll to ensure message is visible above footer
                            // Force scroll using multiple methods
                            el.scrollTop = targetScrollTop;
                            el.scrollTo({ top: targetScrollTop, behavior: 'instant' });

                            // Also try after a frame to ensure it sticks
                            requestAnimationFrame(() => {
                                el.scrollTop = targetScrollTop;
                                el.scrollTo({ top: targetScrollTop, behavior: 'instant' });
                            });

                            if (targetScrollTop > el.scrollTop) {

                                // Double-check after a delay and make a final adjustment if needed
                                setTimeout(() => {
                                    const finalMsgRect = lastMsgEl.getBoundingClientRect();
                                    const finalContainerRect = el.getBoundingClientRect();
                                    const finalInputBar = document.querySelector('.fixed.bottom-0.bg-gray-900');
                                    const finalInputBarHeight = finalInputBar ? finalInputBar.getBoundingClientRect().height : inputBarHeight;
                                    const finalInputBarTop = window.innerHeight - finalInputBarHeight;
                                    const finalVisibleContainerHeight = finalInputBarTop - finalContainerRect.top;
                                    const finalPadding = 180; // Extra padding for final adjustment to ensure full visibility (increased significantly)
                                    const finalTargetMessageBottom = finalVisibleContainerHeight - finalPadding;

                                    const finalMessageTopRelative = finalMsgRect.top - finalContainerRect.top + el.scrollTop;
                                    const finalMessageBottomRelative = finalMessageTopRelative + finalMsgRect.height;

                                    if (finalMessageBottomRelative > el.scrollTop + finalTargetMessageBottom) {
                                        const finalTargetScrollTop = finalMessageBottomRelative - finalTargetMessageBottom;

                                        // Force scroll using multiple methods
                                        el.scrollTop = finalTargetScrollTop;
                                        el.scrollTo({ top: finalTargetScrollTop, behavior: 'instant' });

                                        // Verify and retry if needed
                                        requestAnimationFrame(() => {
                                            if (Math.abs(el.scrollTop - finalTargetScrollTop) > 1) {
                                                el.scrollTop = finalTargetScrollTop;
                                                el.scrollTo({ top: finalTargetScrollTop, behavior: 'instant' });
                                            }
                                        });
                                    }
                                }, 150);
                            }
                        });
                    }
                });
            }
        });

        observer.observe(el, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });

        return () => observer.disconnect();
    }, []);

    React.useEffect(() => {
        async function loadAvatar() {
            if (!handle) return;

            // Get avatar using getAvatarForHandle function
            const avatarUrl = getAvatarForHandle(handle);
            if (avatarUrl) {
                setOtherUserAvatar(avatarUrl);
            } else {
                // If no avatar found, try fetching from API
                try {
                    if (user?.id) {
                        const { fetchUserProfile } = await import('../api/client');
                        const profile = await fetchUserProfile(handle, user.id);
                        if (profile && (profile.avatar_url || profile.avatarUrl)) {
                            setOtherUserAvatar(profile.avatar_url || profile.avatarUrl);
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to fetch avatar for ${handle}:`, error);
                    // Keep undefined to show fallback initial
                }
            }
        }

        loadAvatar();
    }, [handle, user?.id]);

    // Load "places traveled" for the other user so the DM header
    // location icon behaves like the profile page:
    // - If they have explicit places_traveled, use that.
    // - Otherwise, derive places from their bio text.
    // - For mock users like Bob, fall back to the same hard‑coded list
    //   used on the profile page so behavior is consistent.
    React.useEffect(() => {
        async function loadOtherUserPlaces() {
            if (!handle || !user?.id) {
                setOtherUserPlacesTraveled(undefined);
                return;
            }

            try {
                let places: string[] = [];
                const hasToken = typeof localStorage !== 'undefined' && !!localStorage.getItem('authToken');

                if (hasToken) {
                    try {
                        const profile = await fetchUserProfile(handle, user.id);

                        // 1) Try explicit places_traveled / placesTraveled from API
                        const apiPlaces =
                            (profile as any).places_traveled ||
                            (profile as any).placesTraveled;
                        if (Array.isArray(apiPlaces) && apiPlaces.length > 0) {
                            places = apiPlaces;
                        } else if (typeof (profile as any).bio === 'string') {
                            // 2) Derive from bio text (same parsing as profile page)
                            places = parsePlacesFromBio((profile as any).bio);
                        }
                    } catch (error) {
                        console.warn('Failed to fetch profile for places traveled in DMs:', error);
                    }
                }

                // 3) Mock fallback for Bob@Ireland (match ViewProfilePage behavior)
                if ((!places || places.length === 0) && handle === 'Bob@Ireland') {
                    places = ['Cork', 'Galway', 'Belfast', 'London', 'Paris'];
                }

                setOtherUserPlacesTraveled(places && places.length > 0 ? places : []);
            } catch (error) {
                console.error('Error loading other user places traveled:', error);
                setOtherUserPlacesTraveled([]);
            }
        }

        loadOtherUserPlaces();
    }, [handle, user?.id]);

    // Check for unviewed stories, stories status, and follow status
    React.useEffect(() => {
        async function checkStoriesAndFollow() {
            if (!handle || !user?.handle || !user?.id) return;
            try {
                // Check unviewed stories
                const hasUnviewed = await userHasUnviewedStoriesByHandle(handle);
                setHasUnviewedStories(hasUnviewed);
                
                // Check if user has any stories (viewed or unviewed)
                const hasStoriesActive = await userHasStoriesByHandle(handle);
                setHasStories(hasStoriesActive);
                
                // Check follow status
                const followedUsers = await getFollowedUsers(user.id);
                const following = followedUsers.includes(handle);
                setIsFollowing(following);
                setShowFollowCheck(following);
            } catch (error) {
                console.error('Error checking stories/follow status:', error);
            }
        }

        checkStoriesAndFollow();

        // Listen for stories viewed event
        const handleStoriesViewed = (event: CustomEvent) => {
            if (event.detail?.userHandle === handle) {
                setHasUnviewedStories(false);
            }
        };

        window.addEventListener('storiesViewed', handleStoriesViewed as EventListener);

        return () => {
            window.removeEventListener('storiesViewed', handleStoriesViewed as EventListener);
        };
    }, [handle, user?.handle, user?.id]);

    // Show the follow checkmark briefly after following, then hide it
    React.useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (user?.handle && handle && handle !== user.handle && isFollowing) {
            setShowFollowCheck(true);
            timer = setTimeout(() => {
                setShowFollowCheck(false);
            }, 2500);
        } else {
            setShowFollowCheck(false);
        }

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [isFollowing, handle, user?.handle]);

    // Check if conversation is muted
    React.useEffect(() => {
        async function checkMuted() {
            if (!handle || !user?.handle) return;
            try {
                const muted = await isConversationMuted(user.handle, handle);
                setIsMuted(muted);
            } catch (error) {
                console.error('Error checking muted status:', error);
            }
        }

        checkMuted();
    }, [handle, user?.handle]);

    // Listen to Socket.IO events (connection is handled globally in Auth context)
    React.useEffect(() => {
        const socket = getSocket();
        if (socket) {
            // Listen for conversation updates via Socket.IO
            const handleConversationUpdate = (data: any) => {
                const participants: string[] = data.participants || [];
                if (!participants.includes(user?.handle || '') || !participants.includes(handle || '')) return;
                
                // Trigger the existing onUpdate handler
                window.dispatchEvent(new CustomEvent('conversationUpdated', { detail: data }));
            };
            
            const handleInboxUnreadChanged = (data: any) => {
                window.dispatchEvent(new CustomEvent('inboxUnreadChanged', { detail: data }));
            };
            
            socket.on('conversationUpdated', handleConversationUpdate);
            socket.on('inboxUnreadChanged', handleInboxUnreadChanged);
            
            return () => {
                socket.off('conversationUpdated', handleConversationUpdate);
                socket.off('inboxUnreadChanged', handleInboxUnreadChanged);
            };
        }
    }, [user?.handle, handle]);

    // Load conversation from API
    React.useEffect(() => {
        if (!handle || !user?.handle) return;
            fetchConversation(user.handle, handle).then(items => {
            // Ensure ascending order by timestamp so latest is at the bottom
            const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);
            const mapped: MessageUI[] = sorted.map(m => ({
                ...m,
                isFromMe: m.senderHandle === user.handle,
                senderAvatar: m.senderHandle === user.handle ? (user.avatarUrl || getAvatarForHandle(user.handle)) : getAvatarForHandle(handle),
                replyTo: m.replyTo // Preserve replyTo data
            }));
            
            // Debug: Log all messages to see their structure
            console.log('=== LOADED MESSAGES ===');
            mapped.forEach((m, idx) => {
                console.log(`Message ${idx + 1}:`, {
                    id: m.id,
                    sender: m.senderHandle,
                    text: m.text?.substring(0, 50),
                    postId: m.postId || 'NO POST ID',
                    commentId: m.commentId || 'NO COMMENT ID',
                    commentText: m.commentText || 'NO COMMENT TEXT',
                    isSystemMessage: m.isSystemMessage,
                    hasImage: !!m.imageUrl
                });
            });
            console.log('=== END LOADED MESSAGES ===');
            
            setMessages(mapped);
            setLoading(false);
            // Initialize refs
            lastMessageCountRef.current = mapped.length;
            lastMessageIdRef.current = mapped.length > 0 ? mapped[mapped.length - 1].id : null;
            // Scroll to bottom after initial load
            setTimeout(scrollToBottom, 0);
            // Mark as read on open
            markConversationRead(user.handle, handle).catch(() => { });
            const urls = Array.from(new Set(mapped.map(m => m.imageUrl).filter(Boolean) as string[]));
            Promise.all(urls.map(async (u) => [u, await isStoryMediaActive(u)] as const))
                .then(entries => setStoryActiveByUrl(Object.fromEntries(entries)));
            
            // Detect and fetch shared posts (from postId field, URLs in text, and comment notifications)
            const postIds = new Set<string>();
            mapped.forEach(msg => {
                // Check postId field first (most reliable)
                if (msg.postId) {
                    console.log('Found postId in message field:', msg.postId, 'commentText:', msg.commentText);
                    postIds.add(msg.postId);
                }
                // Also check for post URLs in text (fallback)
                else if (msg.text) {
                    const postId = extractPostId(msg.text);
                    if (postId) {
                        console.log('Found post ID in message text:', postId);
                        postIds.add(postId);
                    }
                }
            });
            
            console.log('Fetching posts for IDs:', Array.from(postIds));
            
            // Fetch all detected posts
            Promise.all(Array.from(postIds).map(async (postId) => {
                try {
                    const post = await getPostById(postId, user?.id);
                    if (post) {
                        console.log('Successfully fetched post:', {
                            postId: post.id,
                            userHandle: post.userHandle,
                            hasText: !!post.text,
                            text: post.text?.substring(0, 50),
                            hasMediaUrl: !!post.mediaUrl,
                            mediaUrl: post.mediaUrl,
                            hasMediaItems: !!(post.mediaItems && post.mediaItems.length > 0),
                            mediaItemsCount: post.mediaItems?.length || 0,
                            hasTextStyle: !!post.textStyle,
                            textStyle: post.textStyle
                        });
                        setSharedPosts(prev => ({ ...prev, [postId]: post }));
                    } else {
                        console.warn('Post not found:', postId);
                    }
                } catch (error) {
                    console.error('Failed to fetch shared post:', postId, error);
                }
            }));
        });

        // Live updates
        const onUpdate = (e: any) => {
            const participants: string[] = e.detail?.participants || [];
            if (!participants.includes(user?.handle || '') || !participants.includes(handle || '')) return;

            const newMessage = e.detail?.message;
            const isOurMessage = newMessage && newMessage.senderHandle === user?.handle;

            // If it's our own message, we already have it optimistically - just update it if needed
            if (isOurMessage) {
                setMessages(prev => {
                    // Check if message already exists (by ID or by matching temp message)
                    // For images, also match by imageUrl and timestamp
                    const existingIndex = prev.findIndex(m => {
                        if (m.id === newMessage.id) return true;
                        if (m.id.startsWith('temp-') && Math.abs(m.timestamp - newMessage.timestamp) < 2000) {
                            // Match temp messages by timestamp and content
                            if (newMessage.imageUrl && m.imageUrl) {
                                // For images, match by imageUrl (data URLs will be different, so just check both have images)
                                return true;
                            }
                            if (newMessage.text && m.text && m.text === newMessage.text) {
                                return true;
                            }
                            return true; // Match by timestamp alone if close enough
                        }
                        return false;
                    });
                    
                    if (existingIndex >= 0) {
                        // Update existing message without full reload
                        const updated = [...prev];
                        const existing = updated[existingIndex];
                        updated[existingIndex] = {
                            ...newMessage,
                            isFromMe: true,
                            senderAvatar: user!.avatarUrl || getAvatarForHandle(user!.handle),
                            replyTo: newMessage.replyTo || existing.replyTo, // Preserve replyTo
                            imageUrl: newMessage.imageUrl || existing.imageUrl // Preserve imageUrl if new one doesn't have it
                        };
                        // Clear sending flag after a short delay to allow DOM to settle
                        setTimeout(() => {
                            isSendingMessageRef.current = false;
                        }, 200);
                        return updated;
                    }
                    // If not found, check if we already have a message with the same content to avoid duplicates
                    const duplicateIndex = prev.findIndex(m => 
                        m.isFromMe && 
                        Math.abs(m.timestamp - newMessage.timestamp) < 2000 &&
                        ((newMessage.imageUrl && m.imageUrl) || (newMessage.text && m.text && m.text === newMessage.text))
                    );
                    
                    if (duplicateIndex >= 0) {
                        // Update the duplicate instead of adding a new one
                        const updated = [...prev];
                        updated[duplicateIndex] = {
                            ...newMessage,
                            isFromMe: true,
                            senderAvatar: user!.avatarUrl || getAvatarForHandle(user!.handle),
                            replyTo: newMessage.replyTo
                        };
                        setTimeout(() => {
                            isSendingMessageRef.current = false;
                        }, 200);
                        return updated;
                    }
                    
                    // If not found and no duplicate, add it
                    const result = [...prev, {
                        ...newMessage,
                        isFromMe: true,
                        senderAvatar: user!.avatarUrl || getAvatarForHandle(user!.handle),
                        replyTo: newMessage.replyTo
                    }].sort((a, b) => a.timestamp - b.timestamp);
                    // Clear sending flag after a short delay to allow DOM to settle
                    setTimeout(() => {
                        isSendingMessageRef.current = false;
                    }, 200);
                    return result;
                });
                return; // Don't do full reload for our own messages
            }

            // For other people's messages, do full reload
            fetchConversation(user!.handle!, handle!).then(items => {
                const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);
                
                // Preserve replyTo from existing messages in state
                setMessages(prev => {
                    const replyToMap = new Map(prev.map(m => [m.id, m.replyTo]));
                    
                    const mapped: MessageUI[] = sorted.map(m => ({
                        ...m,
                        isFromMe: m.senderHandle === user!.handle,
                        senderAvatar: m.senderHandle === user!.handle ? (user!.avatarUrl || getAvatarForHandle(user!.handle)) : getAvatarForHandle(handle!),
                        replyTo: m.replyTo || replyToMap.get(m.id) // Use API replyTo or preserve from existing state
                    }));

                    // Reset the refs so the useEffect will detect the change
                    lastMessageCountRef.current = 0;
                    lastMessageIdRef.current = null;
                    
                    // Store mapped for use outside (for story media check)
                    (window as any).__lastMappedMessages = mapped;
                    
                    return mapped;
                });
                
                // Get mapped messages for story media check (use a small delay to ensure state is updated)
                setTimeout(() => {
                    const mapped = (window as any).__lastMappedMessages || sorted.map(m => ({
                        ...m,
                        isFromMe: m.senderHandle === user!.handle,
                        senderAvatar: m.senderHandle === user!.handle ? (user!.avatarUrl || getAvatarForHandle(user!.handle)) : getAvatarForHandle(handle!)
                    }));
                    
                    const urls = Array.from(new Set(mapped.map((m: MessageUI) => m.imageUrl).filter(Boolean) as string[]));
                    Promise.all(urls.map(async (u) => [u, await isStoryMediaActive(u)] as const))
                        .then(entries => setStoryActiveByUrl(Object.fromEntries(entries)));
                }, 10);
                
                // Detect and fetch shared posts in new messages (outside setState to avoid blocking)
                const postIds = new Set<string>();
                sorted.forEach(msg => {
                    // Check postId field first (most reliable)
                    if (msg.postId) {
                        postIds.add(msg.postId);
                    }
                    // Also check for post URLs in text (fallback)
                    else if (msg.text) {
                        const postId = extractPostId(msg.text);
                        if (postId) {
                            postIds.add(postId);
                        }
                    }
                });
                
                // Fetch all detected posts
                if (postIds.size > 0) {
                    Promise.all(Array.from(postIds).map(async (postId) => {
                        try {
                            const post = await getPostById(postId);
                            if (post) {
                                setSharedPosts(prev => ({ ...prev, [postId]: post }));
                            }
                        } catch (error) {
                            console.error('Failed to fetch shared post:', postId, error);
                        }
                    }));
                }

                // Force scroll after messages are set - try multiple times for reliability
                const forceScrollRealTime = () => {
                    const el = listRef.current;
                    if (!el) return;

                    const scrollHeight = el.scrollHeight;
                    el.scrollTop = scrollHeight;

                    // Also try scrollIntoView on last message
                    const lastMsgEl = lastMessageRef.current;
                    if (lastMsgEl) {
                        const inputBar = document.querySelector('.fixed.bottom-0.bg-gray-900');
                        const inputBarHeight = inputBar ? inputBar.getBoundingClientRect().height : 80;

                        setTimeout(() => {
                            const lastMsgRect = lastMsgEl.getBoundingClientRect();
                            const viewportHeight = window.innerHeight;
                            const inputBarTop = viewportHeight - inputBarHeight;

                            if (lastMsgRect.bottom > inputBarTop) {
                                const adjustment = lastMsgRect.bottom - inputBarTop + 20;
                                el.scrollTop = el.scrollTop + adjustment;
                            }
                        }, 10);
                    }
                };

                // Try multiple times with delays to ensure it works
                setTimeout(forceScrollRealTime, 50);
                setTimeout(forceScrollRealTime, 150);
                setTimeout(forceScrollRealTime, 300);
            });
        };
        window.addEventListener('conversationUpdated', onUpdate as any);
        return () => window.removeEventListener('conversationUpdated', onUpdate as any);
    }, [handle, user?.handle, scrollToBottom]);

    const handleSend = async () => {
        if (!messageText.trim()) return;
        if (!user?.handle || !handle) return;

        // Handle editing existing message
        if (editingMessage) {
            try {
                const updatedMessage = await editMessage(editingMessage.id, messageText, user.handle, handle);
                if (updatedMessage) {
                    setMessages(prev => prev.map(msg => 
                        msg.id === editingMessage.id
                            ? { ...msg, text: messageText, edited: true }
                            : msg
                    ));
                    showToast('Message edited');
                } else {
                    showToast('Failed to edit message');
                }
            } catch (error) {
                console.error('Error editing message:', error);
                showToast('Failed to edit message');
            }
            setEditingMessage(null);
            setMessageText('');
            closeContextMenu();
            return;
        }

        // Get postId from pendingSharePostId or extract from text
        const postId = pendingSharePostId || extractPostId(messageText);
        
        if (postId && !sharedPosts[postId]) {
            getPostById(postId, user?.id).then(post => {
                if (post) setSharedPosts(prev => ({ ...prev, [postId]: post }));
            }).catch(() => {});
        }

        // Set flag to prevent auto-scroll during message sending
        isSendingMessageRef.current = true;

        // Optimistically add message to state immediately for instant UI update
        const tempMessage: MessageUI = {
            id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            senderHandle: user.handle,
            text: messageText,
            timestamp: Date.now(),
            isFromMe: true,
            senderAvatar: user.avatarUrl || getAvatarForHandle(user.handle),
            isSystemMessage: false,
            postId: postId || undefined, // Include postId if available
            replyTo: replyingTo ? {
                messageId: replyingTo.id,
                text: replyingTo.text || '',
                senderHandle: replyingTo.senderHandle,
                imageUrl: replyingTo.imageUrl
            } : undefined
        };

        // Add message immediately to state
        setMessages(prev => {
            const sorted = [...prev, tempMessage].sort((a, b) => a.timestamp - b.timestamp);
            return sorted;
        });
        // Store replyTo data before clearing replyingTo state (use shared post thumbnail for screenshot when replying to shared post)
        const replyToData = replyingTo ? (() => {
            const replyPostId = replyingTo.postId || extractPostId(replyingTo.text || '');
            const replyPost = replyPostId ? sharedPosts[replyPostId] : null;
            const thumbnailUrl = replyingTo.imageUrl || replyPost?.mediaUrl;
            const mediaType = replyPost?.mediaType;
            return {
                messageId: replyingTo.id,
                text: replyingTo.text || '',
                senderHandle: replyingTo.senderHandle,
                imageUrl: thumbnailUrl,
                ...(mediaType && { mediaType })
            };
        })() : undefined;
        
        setMessageText('');
        setPendingSharePostId(null); // Clear pending postId
        setReplyingTo(null); // Clear reply state

        // Don't manually scroll - let the useLayoutEffect handle it after flag is cleared
        // This prevents multiple scrolls causing jerking

        // Then send to API - replace temp message with real one to preserve replyTo
        const tempId = tempMessage.id;
        appendMessage(user.handle, handle, { 
            text: messageText,
            postId: postId || undefined,
            replyTo: replyToData
        }).then((realMessage) => {
            // Update temp message with real one - the onUpdate handler will handle it, but we update here too for immediate feedback
            setMessages(prev => {
                // Remove temp message
                const filtered = prev.filter(m => m.id !== tempId);
                // Check if real message already exists (from conversationUpdated event)
                const existingIndex = filtered.findIndex(m => m.id === realMessage.id);
                
                if (existingIndex >= 0) {
                    // Update existing message to ensure replyTo is preserved
                    const updated = [...filtered];
                    updated[existingIndex] = {
                        ...updated[existingIndex],
                        replyTo: realMessage.replyTo || updated[existingIndex].replyTo
                    };
                    // Clear sending flag after a short delay to allow DOM to settle
                    setTimeout(() => {
                        isSendingMessageRef.current = false;
                    }, 200);
                    return updated;
                } else {
                    // Add new message
                    const newMessage: MessageUI = {
                        ...realMessage,
                        isFromMe: true,
                        senderAvatar: user.avatarUrl || getAvatarForHandle(user.handle),
                        replyTo: realMessage.replyTo // Preserve replyTo from API
                    };
                    const sorted = [...filtered, newMessage].sort((a, b) => a.timestamp - b.timestamp);
                    // Clear sending flag after a short delay to allow DOM to settle
                    setTimeout(() => {
                        isSendingMessageRef.current = false;
                    }, 200);
                    return sorted;
                }
            });
        }).catch(error => {
            console.error('Error sending message:', error);
            // Clear flag on error too
            isSendingMessageRef.current = false;
        });
    };

    const handleSendSticker = async (sticker: string) => {
        if (!user?.handle || !handle) return;

        // Use ref first (set synchronously when opening picker) so we don't lose the message to state timing
        const targetMessage = messageForStickerRef.current ?? messageForSticker;
        messageForStickerRef.current = null;
        setShowStickerPicker(false);
        setMessageForSticker(null);

        const sendStickerAsImage = (imageUrl: string) => {
            const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const tempMessage: MessageUI = {
                id: tempId,
                senderHandle: user.handle,
                imageUrl,
                timestamp: Date.now(),
                isFromMe: true,
                senderAvatar: user.avatarUrl || getAvatarForHandle(user.handle),
                isSystemMessage: false
            };
            setMessages(prev => {
                const sorted = [...prev, tempMessage].sort((a, b) => a.timestamp - b.timestamp);
                return sorted;
            });
            setTimeout(() => scrollToBottom(), 100);
            appendMessage(user.handle, handle, { imageUrl }).then((realMessage) => {
                setMessages(prev => {
                    const filtered = prev.filter(m => m.id !== tempId);
                    const existingIndex = filtered.findIndex(m => m.id === realMessage.id);
                    if (existingIndex >= 0) {
                        const updated = [...filtered];
                        updated[existingIndex] = {
                            ...realMessage,
                            isFromMe: true,
                            senderAvatar: user.avatarUrl || getAvatarForHandle(user.handle),
                            imageUrl: realMessage.imageUrl || updated[existingIndex].imageUrl
                        };
                        return updated;
                    }
                    return [...filtered, { ...realMessage, isFromMe: true, senderAvatar: user.avatarUrl || getAvatarForHandle(user.handle), imageUrl: realMessage.imageUrl }].sort((a, b) => a.timestamp - b.timestamp);
                });
            }).catch(() => {});
        };

        // If opened from long-press "Add sticker": add sticker as reaction and run pop → fly-to-card animation
        if (targetMessage) {
            handleAddReaction(targetMessage.id, sticker);
            setStickerReactionAnimation({ messageId: targetMessage.id, emoji: sticker, phase: 'pop' });
            return;
        }

        // Default: send sticker as text (emoji message)
        const tempMessage: MessageUI = {
            id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            senderHandle: user.handle,
            text: sticker,
            timestamp: Date.now(),
            isFromMe: true,
            senderAvatar: user.avatarUrl || getAvatarForHandle(user.handle),
            isSystemMessage: false
        };
        setMessages(prev => {
            const sorted = [...prev, tempMessage].sort((a, b) => a.timestamp - b.timestamp);
            return sorted;
        });
        setTimeout(() => scrollToBottom(), 100);
        await appendMessage(user.handle, handle, { text: sticker });
    };

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset file input to allow selecting the same file again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const imageUrl = reader.result as string;
            if (!user?.handle || !handle) return;
            // Show image compose UI: preview + optional caption before sending
            setImageCompose({ imageUrl, caption: '' });
        };
        reader.readAsDataURL(file);
    };

    const handleCancelImageCompose = () => {
        setImageCompose(null);
    };

    const handleSendImageWithCaption = async () => {
        if (!imageCompose || !user?.handle || !handle) return;
        const { imageUrl, caption } = imageCompose;
        setImageCompose(null);

        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const tempMessage: MessageUI = {
            id: tempId,
            senderHandle: user.handle,
            imageUrl,
            text: caption.trim() || undefined,
            timestamp: Date.now(),
            isFromMe: true,
            senderAvatar: user.avatarUrl || getAvatarForHandle(user.handle),
            isSystemMessage: false
        };

        setMessages(prev => {
            const sorted = [...prev, tempMessage].sort((a, b) => a.timestamp - b.timestamp);
            return sorted;
        });
        setTimeout(() => scrollToBottom(), 100);
        isSendingMessageRef.current = true;

        appendMessage(user.handle, handle, { imageUrl, text: caption.trim() || undefined }).then((realMessage) => {
            setMessages(prev => {
                const filtered = prev.filter(m => m.id !== tempId);
                const existingIndex = filtered.findIndex(m => m.id === realMessage.id);
                if (existingIndex >= 0) {
                    const updated = [...filtered];
                    updated[existingIndex] = {
                        ...realMessage,
                        isFromMe: true,
                        senderAvatar: user.avatarUrl || getAvatarForHandle(user.handle),
                        imageUrl: realMessage.imageUrl || updated[existingIndex].imageUrl
                    };
                    setTimeout(() => { isSendingMessageRef.current = false; }, 200);
                    return updated;
                }
                const newMessage: MessageUI = {
                    ...realMessage,
                    isFromMe: true,
                    senderAvatar: user.avatarUrl || getAvatarForHandle(user.handle)
                };
                const sorted = [...filtered, newMessage].sort((a, b) => a.timestamp - b.timestamp);
                setTimeout(() => { isSendingMessageRef.current = false; }, 200);
                return sorted;
            });
        }).catch(error => {
            console.error('Error sending image:', error);
            isSendingMessageRef.current = false;
        });
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

    // Handle long-press (mobile) and right-click (desktop)
    const handleMessageLongPress = (msg: MessageUI, e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setContextMenu({
            message: msg,
            x: e.type === 'touchstart' ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX,
            y: e.type === 'touchstart' ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY
        });
    };

    const handleMessageContextMenu = (msg: MessageUI, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setContextMenu({
            message: msg,
            x: e.clientX,
            y: e.clientY
        });
    };

    // Swipe gesture state
    const swipeStartRef = React.useRef<{ x: number; y: number; message: MessageUI | null } | null>(null);
    const [swipeOffset, setSwipeOffset] = React.useState(0);
    const [swipingMessageId, setSwipingMessageId] = React.useState<string | null>(null);

    // Handle long-press start and swipe detection
    const handleTouchStart = (msg: MessageUI, e: React.TouchEvent) => {
        const touch = e.touches[0];
        swipeStartRef.current = { x: touch.clientX, y: touch.clientY, message: msg };
        setSwipingMessageId(msg.id);
        
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
        }
        longPressTimerRef.current = setTimeout(() => {
            handleMessageLongPress(msg, e);
        }, 500); // 500ms for long press
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!swipeStartRef.current) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - swipeStartRef.current.x;
        const deltaY = Math.abs(touch.clientY - swipeStartRef.current.y);
        
        // Only detect horizontal swipe (more horizontal than vertical)
        if (Math.abs(deltaX) > deltaY && deltaX > 0 && !swipeStartRef.current.message?.isFromMe) {
            // Swipe right on received message = reply
            setSwipeOffset(Math.min(deltaX, 100)); // Max 100px swipe
        }
    };

    // Handle long-press end
    const handleTouchEnd = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        
        // Check if swipe was significant enough to trigger reply
        if (swipeStartRef.current && swipeOffset > 50) {
            setReplyingTo(swipeStartRef.current.message);
            setSwipeOffset(0);
        } else {
            setSwipeOffset(0);
        }
        
        setSwipingMessageId(null);
        swipeStartRef.current = null;
    };

    // Close context menu
    const closeContextMenu = () => {
        setContextMenu(null);
    };

    // Handle context menu actions
    const handleReply = () => {
        if (!contextMenu?.message) return;
        setReplyingTo(contextMenu.message);
        closeContextMenu();
    };

    const handleForward = async () => {
        if (!contextMenu?.message || !user?.handle) return;
        
        // Get list of conversations to forward to
        const { listConversations } = await import('../api/messages');
        const conversations = await listConversations(user.handle);
        
        // Filter out current conversation
        const otherConversations = conversations.filter(conv => conv.otherHandle !== handle);
        
        setAvailableConversations(otherConversations);
        setForwardingMessage(contextMenu.message);
        closeContextMenu();
    };
    
    const handleForwardToConversation = async (targetHandle: string) => {
        if (!forwardingMessage || !user?.handle) return;
        
        try {
            // Forward the message text (and image if present)
            await appendMessage(user.handle, targetHandle, {
                text: forwardingMessage.text ? `Forwarded: ${forwardingMessage.text}` : undefined,
                imageUrl: forwardingMessage.imageUrl,
                audioUrl: forwardingMessage.audioUrl,
            });
            
            showToast('Message forwarded');
            setForwardingMessage(null);
            setAvailableConversations([]);
        } catch (error) {
            console.error('Error forwarding message:', error);
            showToast('Failed to forward message');
        }
    };

    const handleTranslate = async () => {
        if (!contextMenu?.message || !contextMenu.message.text) return;
        
        const messageId = contextMenu.message.id;
        const text = contextMenu.message.text;
        
        // If already translated, toggle it off
        if (translatedMessages[messageId]) {
            setTranslatedMessages(prev => {
                const next = { ...prev };
                delete next[messageId];
                return next;
            });
            closeContextMenu();
            return;
        }
        
        try {
            // Use browser's built-in translation or a simple API
            // For now, we'll use a mock translation (in production, use Google Translate API or similar)
            // Note: This is a placeholder - you'd need to integrate with a real translation service
            const translatedText = await translateText(text);
            
            setTranslatedMessages(prev => ({
                ...prev,
                [messageId]: translatedText
            }));
            
            showToast('Message translated');
        } catch (error) {
            console.error('Translation error:', error);
            showToast('Failed to translate message');
        }
        
        closeContextMenu();
    };
    
    // Simple translation function (placeholder - replace with real API)
    const translateText = async (text: string): Promise<string> => {
        // In production, use Google Translate API, DeepL, or similar
        // For now, return a mock translation
        return new Promise((resolve) => {
            setTimeout(() => {
                // Mock translation - in production, call actual translation API
                resolve(`[Translated] ${text}`);
            }, 500);
        });
    };

    const handleReport = () => {
        if (!contextMenu?.message) return;
        setReportingMessage(contextMenu.message);
        setReportReason('');
        closeContextMenu();
    };
    
    const handleSubmitReport = async () => {
        if (!reportingMessage || !reportReason.trim() || !user?.handle) return;
        
        try {
            // In production, send report to backend API
            // For now, just log and show success message
            console.log('Reporting message:', {
                messageId: reportingMessage.id,
                senderHandle: reportingMessage.senderHandle,
                reason: reportReason,
                reporterHandle: user.handle
            });
            
            // TODO: Call backend API to report message
            // await apiRequest('/api/messages/report', {
            //     method: 'POST',
            //     body: JSON.stringify({
            //         message_id: reportingMessage.id,
            //         reason: reportReason
            //     })
            // });
            
            showToast('Message reported. Thank you for your feedback.');
            setReportingMessage(null);
            setReportReason('');
        } catch (error) {
            console.error('Error reporting message:', error);
            showToast('Failed to report message');
        }
    };

    // Handle adding reaction to message
    const handleAddReaction = (messageId: string, emoji: string) => {
        if (!user?.handle) return;
        
        setMessageReactions(prev => {
            const current = prev[messageId] || [];
            const existingReaction = current.find(r => r.emoji === emoji);
            
            if (existingReaction) {
                // Toggle: if user already reacted, remove; otherwise add
                const userIndex = existingReaction.users.indexOf(user.handle);
                if (userIndex > -1) {
                    // Remove user from reaction
                    const updatedUsers = existingReaction.users.filter(u => u !== user.handle);
                    if (updatedUsers.length === 0) {
                        // Remove reaction entirely if no users left
                        return {
                            ...prev,
                            [messageId]: current.filter(r => r.emoji !== emoji)
                        };
                    }
                    return {
                        ...prev,
                        [messageId]: current.map(r => 
                            r.emoji === emoji 
                                ? { ...r, users: updatedUsers }
                                : r
                        )
                    };
                } else {
                    // Add user to reaction
                    return {
                        ...prev,
                        [messageId]: current.map(r => 
                            r.emoji === emoji 
                                ? { ...r, users: [...r.users, user.handle] }
                                : r
                        )
                    };
                }
            } else {
                // Add new reaction
                return {
                    ...prev,
                    [messageId]: [...current, { emoji, users: [user.handle] }]
                };
            }
        });
    };

    // Handle cancel reply
    const handleCancelReply = () => {
        setReplyingTo(null);
    };

    // Handle cancel edit
    const handleCancelEdit = () => {
        setEditingMessage(null);
        setMessageText('');
    };

    // Handle edit message
    const handleEditMessage = () => {
        if (!contextMenu?.message) return;
        setEditingMessage(contextMenu.message);
        setMessageText(contextMenu.message.text || '');
        closeContextMenu();
    };

    // Close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = () => {
            if (contextMenu) {
                closeContextMenu();
            }
        };

        if (contextMenu) {
            document.addEventListener('click', handleClickOutside);
            document.addEventListener('contextmenu', handleClickOutside);
            return () => {
                document.removeEventListener('click', handleClickOutside);
                document.removeEventListener('contextmenu', handleClickOutside);
            };
        }
    }, [contextMenu]);

    // Sticker reaction animation: after "pop" phase, find reaction pill and switch to "fly" phase
    useEffect(() => {
        if (!stickerReactionAnimation || stickerReactionAnimation.phase !== 'pop') return;
        const timer = setTimeout(() => {
            const candidates = document.querySelectorAll(`[data-reaction-message-id="${stickerReactionAnimation.messageId}"]`);
            const el = Array.from(candidates).find((n) => n.getAttribute('data-reaction-emoji') === stickerReactionAnimation.emoji);
            if (el) {
                const rect = el.getBoundingClientRect();
                setStickerReactionAnimation((prev) => (prev ? { ...prev, phase: 'fly', targetRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } } : null));
            } else {
                setStickerReactionAnimation(null);
            }
        }, 380);
        return () => clearTimeout(timer);
    }, [stickerReactionAnimation?.messageId, stickerReactionAnimation?.emoji, stickerReactionAnimation?.phase]);

    // Sticker reaction animation: after "fly" phase ends, clear overlay
    useEffect(() => {
        if (!stickerReactionAnimation || stickerReactionAnimation.phase !== 'fly') return;
        const timer = setTimeout(() => setStickerReactionAnimation(null), 420);
        return () => clearTimeout(timer);
    }, [stickerReactionAnimation?.phase, stickerReactionAnimation?.messageId]);

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
                            <div className="relative overflow-visible flex-shrink-0">
                                <Avatar
                                    src={otherUserAvatar}
                                    name={handle}
                                    size="sm"
                                    hasStory={hasUnviewedStories}
                                    className="cursor-pointer"
                                    onClick={() => {
                                        if (hasUnviewedStories || hasStories) {
                                            navigate('/stories', { state: { openUserHandle: handle } });
                                        } else {
                                            navigate(`/user/${encodeURIComponent(handle)}`);
                                        }
                                    }}
                                />
                                {/* + icon overlay on profile picture to follow (TikTok style) */}
                                {user?.handle && handle !== user.handle && (isFollowing === false || isFollowing === undefined) && (
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (isFollowLoading || !user?.id) return;
                                            setIsFollowLoading(true);
                                            
                                            try {
                                                // Check if profile is private and has pending request
                                                const { isProfilePrivate, hasPendingFollowRequest } = await import('../api/privacy');
                                                const profilePrivate = isProfilePrivate(handle);
                                                const hasPending = hasPendingFollowRequest(user.handle, handle);
                                                
                                                // If profile is private and already has pending request, show message
                                                if (profilePrivate && hasPending) {
                                                    Swal.fire({
                                                        title: 'Gazetteer says',
                                                        customClass: {
                                                            title: 'gazetteer-shimmer',
                                                            popup: '!rounded-2xl !shadow-xl !border-0',
                                                            container: '!p-0',
                                                            confirmButton: '!rounded-lg !px-6 !py-2 !text-sm !font-semibold !mt-4 !mb-6 !bg-[#0095f6] !hover:bg-[#0084d4] !transition-colors'
                                                        },
                                                        html: `
                                                            <div style="text-align: center; padding: 8px 0;">
                                                                <div style="width: 60px; height: 60px; margin: 0 auto 20px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
                                                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                        <circle cx="12" cy="12" r="10"></circle>
                                                                        <polyline points="12 6 12 12 16 14"></polyline>
                                                                    </svg>
                                                                </div>
                                                                <h3 style="font-size: 20px; font-weight: 600; color: #262626; margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Follow Request Already Sent</h3>
                                                                <p style="font-size: 14px; color: #8e8e8e; margin: 0; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">You have already sent a follow request to ${handle}. You will be notified when they respond.</p>
                                                            </div>
                                                        `,
                                                        showConfirmButton: true,
                                                        confirmButtonText: 'OK',
                                                        confirmButtonColor: '#0095f6',
                                                        background: '#ffffff',
                                                        width: '400px',
                                                        padding: '0',
                                                        buttonsStyling: false
                                                    });
                                                    setIsFollowLoading(false);
                                                    return;
                                                }
                                                
                                                // Update local state first (optimistic update)
                                                const s = getState(user.id);
                                                const wasFollowing = s.follows[handle] === true;
                                                const newFollowingState = !wasFollowing;
                                                s.follows[handle] = newFollowingState;
                                                
                                                // Update UI immediately
                                                setIsFollowing(newFollowingState);
                                                
                                                // Try to call API
                                                try {
                                                    const result = await toggleFollow(handle);
                                                    console.log('Toggle follow result:', result);
                                                    
                                                    // If API call succeeds and returns different state, sync it
                                                    if (result && typeof result.following === 'boolean') {
                                                        s.follows[handle] = result.following;
                                                        setIsFollowing(result.following);
                                                    }
                                                    
                                                    showToast(newFollowingState ? 'Following' : 'Unfollowed');
                                                } catch (apiError) {
                                                    console.warn('API follow failed, using local state:', apiError);
                                                    // If API fails, keep the optimistic update
                                                    // This allows offline functionality
                                                    showToast(newFollowingState ? 'Following' : 'Unfollowed');
                                                }
                                            } catch (error) {
                                                console.error('Error toggling follow:', error);
                                                // Revert optimistic update on unexpected error
                                                const s = getState(user.id);
                                                const currentState = s.follows[handle] === true;
                                                setIsFollowing(currentState);
                                                showToast('Failed to update follow status');
                                            } finally {
                                                setIsFollowLoading(false);
                                            }
                                        }}
                                        disabled={isFollowLoading}
                                        className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-blue-500 hover:bg-blue-600 border-2 border-white dark:border-gray-900 flex items-center justify-center transition-all duration-200 active:scale-90 shadow-lg z-30"
                                        aria-label="Follow user"
                                    >
                                        <FiPlus className="w-3 h-3 text-white" strokeWidth={2.5} />
                                    </button>
                                )}
                                {/* Checkmark icon when following (replaces + icon) */}
                                {user?.handle && handle !== user.handle && isFollowing && showFollowCheck && (
                                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 flex items-center justify-center shadow-lg z-30">
                                        <FiCheck className="w-3 h-3 text-white" strokeWidth={3} />
                                    </div>
                                )}
                            </div>
                            <div className="ml-3 flex-1">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => navigate(`/user/${encodeURIComponent(handle)}`)}
                                        className="text-left"
                                    >
                                        <span className="font-semibold text-white">{handle}</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-xs text-gray-400">Active now</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        {/* Location Icon Button */}
                        {handle && (
                            <button
                                className="p-2 hover:bg-gray-900 rounded-full transition-colors"
                                onClick={() => {
                                    // If no places traveled, show the "No Places Traveled" card
                                    if (!otherUserPlacesTraveled || otherUserPlacesTraveled.length === 0) {
                                        Swal.fire({
                                            title: '',
                                            html: `
                                                <p style="font-size: 12px; color: #6b7280; margin: 0 0 10px 0; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;">Gazetteer says</p>
                                                <div style="text-align: center; padding: 8px 0;">
                                                    <div style="width: 60px; height: 60px; margin: 0 auto 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                                            <circle cx="12" cy="10" r="3"></circle>
                                                        </svg>
                                                    </div>
                                                    <h3 style="font-size: 20px; font-weight: 600; color: #262626; margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">No Places Traveled</h3>
                                                    <p style="font-size: 14px; color: #8e8e8e; margin: 0; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${handle} hasn't added any places they've traveled to their profile yet.</p>
                                                </div>
                                            `,
                                            showConfirmButton: true,
                                            confirmButtonText: 'OK',
                                            confirmButtonColor: '#0095f6',
                                            background: '#ffffff',
                                            width: '400px',
                                            padding: '0',
                                            customClass: {
                                                popup: '!rounded-2xl !shadow-xl !border-0',
                                                container: '!p-0',
                                                confirmButton: '!rounded-lg !px-6 !py-2 !text-sm !font-semibold !mt-4 !mb-6 !bg-[#0095f6] !hover:bg-[#0084d4] !transition-colors'
                                            },
                                            buttonsStyling: false
                                        });
                                    } else {
                                        // Show a places traveled card (SweetAlert) using the same data
                                        const placesHtml = otherUserPlacesTraveled
                                            .map(place => `<li style="padding: 6px 0; border-bottom: 1px solid #f3f4f6;">${place}</li>`)
                                            .join('');

                                        Swal.fire({
                                            title: 'Gazetteer says',
                                            html: `
                                                <div style="text-align: left; padding: 8px 0;">
                                                    <div style="width: 60px; height: 60px; margin: 0 auto 20px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);">
                                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                                            <circle cx="12" cy="10" r="3"></circle>
                                                        </svg>
                                                    </div>
                                                    <h3 style="font-size: 20px; font-weight: 600; color: #262626; margin: 0 0 12px 0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Places Traveled</h3>
                                                    <ul style="list-style: none; margin: 0; padding: 0 4px 0 4px; max-height: 260px; overflow-y: auto;">
                                                        ${placesHtml}
                                                    </ul>
                                                </div>
                                            `,
                                            showConfirmButton: true,
                                            confirmButtonText: 'OK',
                                            confirmButtonColor: '#0095f6',
                                            background: '#ffffff',
                                            width: '400px',
                                            padding: '0',
                                            customClass: {
                                                popup: '!rounded-2xl !shadow-xl !border-0',
                                                container: '!p-0',
                                                confirmButton: '!rounded-lg !px-6 !py-2 !text-sm !font-semibold !mt-4 !mb-6 !bg-[#0095f6] !hover:bg-[#0084d4] !transition-colors'
                                            },
                                            buttonsStyling: false
                                        });
                                    }
                                }}
                                title="View places traveled"
                            >
                                <FiMapPin className="w-6 h-6" />
                            </button>
                        )}
                        <button
                            className="p-2 hover:bg-gray-900 rounded-full transition-colors"
                            onClick={() => setShowChatInfo(true)}
                        >
                            <FiMoreHorizontal className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 pb-40" style={{ minHeight: 0, maxHeight: 'calc(100vh - 120px)' }}>
                <div className="space-y-1">
                    {messages.map((msg, idx) => {
                        const showTimestamp = idx === 0 ||
                            (msg.timestamp - messages[idx - 1].timestamp) > 60000; // gap > 1 minute
                        const isLastMessage = idx === messages.length - 1;

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
                                    <div
                                        ref={isLastMessage ? lastMessageRef : null}
                                        data-message-id={msg.id}
                                        className={`flex ${msg.isFromMe ? 'justify-end' : 'justify-start'} ${showTimestamp ? 'mt-4' : ''}`}
                                    >
                                        {msg.isFromMe ? (
                                            (() => {
                                                // Check postId field first, then extract from text
                                                const postId = msg.postId || (msg.text ? extractPostId(msg.text) : null);
                                                const sharedPost = postId ? sharedPosts[postId] : null;
                                                
                                                // Debug logging
                                                if (postId && !sharedPost) {
                                                    console.log('Post ID detected but not yet loaded:', postId);
                                                }
                                                if (sharedPost) {
                                                    console.log('Rendering SharedPostCard for post:', sharedPost.id, 'isTextOnly:', !sharedPost.mediaUrl && (!sharedPost.mediaItems || sharedPost.mediaItems.length === 0) && sharedPost.text);
                                                }
                                                
                                                // If it's a shared post, render outside the bubble (tappable → Scenes); long-press opens react card
                                                if (sharedPost) {
                                                    return (
                                                        <div className="w-full flex justify-end mb-2" style={{ maxWidth: '100%' }}>
                                                            <div
                                                                className="relative"
                                                                style={{ maxWidth: '448px', width: '100%' }}
                                                                onContextMenu={(e) => { e.preventDefault(); handleMessageContextMenu(msg, e); }}
                                                                onTouchStart={(e) => handleTouchStart(msg, e)}
                                                                onTouchMove={handleTouchMove}
                                                                onTouchEnd={handleTouchEnd}
                                                                onTouchCancel={handleTouchEnd}
                                                            >
                                                                <SharedPostCard post={sharedPost} onTap={openScenesForPost} />
                                                                {messageReactions[msg.id] && messageReactions[msg.id].length > 0 && (
                                                                    <div className="absolute bottom-2 right-2 flex items-center gap-0.5">
                                                                        {messageReactions[msg.id].map((reaction, idx) => {
                                                                            const isHeart = reaction.emoji === '❤️';
                                                                            return (
                                                                                <button key={`${idx}-${reaction.emoji}`} data-reaction-message-id={msg.id} data-reaction-emoji={reaction.emoji} onClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); handleAddReaction(msg.id, reaction.emoji); }} className={isHeart ? 'rounded-full px-1 py-0.5 flex items-center gap-1 bg-transparent' : 'bg-white/90 rounded-full px-1.5 py-0.5 flex items-center gap-1 shadow-sm'}>
                                                                                    {isHeart ? <span className="text-red-500"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg></span> : <span className="text-sm">{reaction.emoji}</span>}
                                                                                    {reaction.users.length > 1 && <span className="text-[10px] font-medium text-gray-600">{reaction.users.length}</span>}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                
                                                // Post ID detected but not loaded: show preview card, tap to view in Scenes; long-press opens react card
                                                if (postId && !sharedPost) {
                                                    return (
                                                        <div className="w-full flex justify-end mb-2" style={{ maxWidth: '100%' }}>
                                                            <div
                                                                data-message-bubble-id={msg.id}
                                                                className="relative"
                                                                style={{ maxWidth: '448px', width: '100%' }}
                                                                onContextMenu={(e) => { e.preventDefault(); handleMessageContextMenu(msg, e); }}
                                                                onTouchStart={(e) => handleTouchStart(msg, e)}
                                                                onTouchMove={handleTouchMove}
                                                                onTouchEnd={handleTouchEnd}
                                                                onTouchCancel={handleTouchEnd}
                                                            >
                                                                <SharedPostPreviewCard postId={postId} onTap={() => openScenesForPostId(postId)} userId={user?.id} />
                                                                {messageReactions[msg.id] && messageReactions[msg.id].length > 0 && (
                                                                    <div className="absolute bottom-2 right-2 flex items-center gap-0.5">
                                                                        {messageReactions[msg.id].map((reaction, idx) => {
                                                                            const isHeart = reaction.emoji === '❤️';
                                                                            return (
                                                                                <button key={`${idx}-${reaction.emoji}`} data-reaction-message-id={msg.id} data-reaction-emoji={reaction.emoji} onClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); handleAddReaction(msg.id, reaction.emoji); }} className={isHeart ? 'rounded-full px-1 py-0.5 flex items-center gap-1' : 'bg-white/90 rounded-full px-1.5 py-0.5 flex items-center gap-1 shadow-sm'}>
                                                                                    {isHeart ? <span className="text-red-500"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg></span> : <span className="text-sm">{reaction.emoji}</span>}
                                                                                    {reaction.users.length > 1 && <span className="text-[10px] font-medium text-gray-600">{reaction.users.length}</span>}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                
                                                // Regular message - render in bubble (only if not a post URL)
                                                // Don't show text if it's a post URL (we show SharedPostCard or loading state instead)
                                                if (postId) {
                                                    // Post URL detected - already handled above with SharedPostCard or loading state
                                                    return null;
                                                }
                                                
                                                // Also check if text contains a post URL pattern - if so, don't show the text
                                                // (it might be loading or the postId wasn't set properly)
                                                const hasPostUrlPattern = msg.text && (
                                                    msg.text.includes('/post/') || 
                                                    msg.text.includes('http://') || 
                                                    msg.text.includes('https://')
                                                );
                                                
                                                if (hasPostUrlPattern && !postId) {
                                                    // URL detected but no postId - try to extract it and fetch
                                                    const extractedPostId = extractPostId(msg.text || '');
                                                    if (extractedPostId) {
                                                        // If we already have the post, render it (tappable → Scenes)
                                                        if (sharedPosts[extractedPostId]) {
                                                            return (
                                                                <div className="w-full flex justify-end mb-2" style={{ maxWidth: '100%' }}>
                                                                    <div data-message-bubble-id={msg.id} className="relative" style={{ maxWidth: '448px', width: '100%' }} onContextMenu={(e) => { e.preventDefault(); handleMessageContextMenu(msg, e); }} onTouchStart={(e) => handleTouchStart(msg, e)} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchEnd}>
                                                                        <SharedPostCard post={sharedPosts[extractedPostId]} onTap={openScenesForPost} />
                                                                        {messageReactions[msg.id]?.length > 0 && (
                                                                            <div className="absolute bottom-2 right-2 flex items-center gap-0.5">
                                                                                {messageReactions[msg.id].map((reaction, idx) => {
                                                                                    const isHeart = reaction.emoji === '❤️';
                                                                                    return (
                                                                                        <button key={`${idx}-${reaction.emoji}`} data-reaction-message-id={msg.id} data-reaction-emoji={reaction.emoji} onClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); handleAddReaction(msg.id, reaction.emoji); }} className={isHeart ? 'rounded-full px-1 py-0.5 flex items-center gap-1' : 'bg-white/90 rounded-full px-1.5 py-0.5 flex items-center gap-1 shadow-sm'}>
                                                                                            {isHeart ? <span className="text-red-500"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg></span> : <span className="text-sm">{reaction.emoji}</span>}
                                                                                            {reaction.users.length > 1 && <span className="text-[10px] font-medium text-gray-600">{reaction.users.length}</span>}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        if (!sharedPosts[extractedPostId]) {
                                                            getPostById(extractedPostId, user?.id).then(post => { if (post) setSharedPosts(prev => ({ ...prev, [extractedPostId]: post })); }).catch(() => {});
                                                        }
                                                        return (
                                                            <div className="w-full flex justify-end mb-2" style={{ maxWidth: '100%' }}>
                                                                <div data-message-bubble-id={msg.id} className="relative" style={{ maxWidth: '448px', width: '100%' }} onContextMenu={(e) => { e.preventDefault(); handleMessageContextMenu(msg, e); }} onTouchStart={(e) => handleTouchStart(msg, e)} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchEnd}>
                                                                    <SharedPostPreviewCard postId={extractedPostId} onTap={() => openScenesForPostId(extractedPostId)} userId={user?.id} />
                                                                    {messageReactions[msg.id]?.length > 0 && (
                                                                        <div className="absolute bottom-2 right-2 flex items-center gap-0.5">
                                                                            {messageReactions[msg.id].map((reaction, idx) => {
                                                                                const isHeart = reaction.emoji === '❤️';
                                                                                return (
                                                                                    <button key={`${idx}-${reaction.emoji}`} data-reaction-message-id={msg.id} data-reaction-emoji={reaction.emoji} onClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); handleAddReaction(msg.id, reaction.emoji); }} className={isHeart ? 'rounded-full px-1 py-0.5 flex items-center gap-1' : 'bg-white/90 rounded-full px-1.5 py-0.5 flex items-center gap-1 shadow-sm'}>
                                                                                        {isHeart ? <span className="text-red-500"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg></span> : <span className="text-sm">{reaction.emoji}</span>}
                                                                                        {reaction.users.length > 1 && <span className="text-[10px] font-medium text-gray-600">{reaction.users.length}</span>}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                }
                                                
                                                return (
                                                    <div className="flex items-start gap-2 max-w-[75%] ml-auto">
                                                        {msg.senderAvatar && (
                                                            <Avatar
                                                                src={msg.senderAvatar}
                                                                name={msg.senderHandle}
                                                                size="sm"
                                                                className="flex-shrink-0 order-2 cursor-pointer"
                                                                onClick={() => {
                                                                    if (user?.handle) {
                                                                        navigate(`/user/${encodeURIComponent(user.handle)}`);
                                                                    }
                                                                }}
                                                            />
                                                        )}
                                                        <div className="flex flex-col items-end gap-1 flex-1 min-w-0 order-1">
                                                            <div
                                                                data-message-bubble-id={msg.id}
                                                                className="bg-[#0095f6] rounded-2xl rounded-tr-sm px-4 py-2.5 break-words cursor-pointer select-none shadow-sm relative"
                                                            style={{
                                                                maxWidth: '100%',
                                                                wordBreak: 'break-word',
                                                                overflowWrap: 'break-word',
                                                                transform: swipingMessageId === msg.id ? `translateX(${swipeOffset}px)` : 'translateX(0)',
                                                                transition: swipeOffset === 0 ? 'transform 0.2s' : 'none',
                                                                paddingBottom: messageReactions[msg.id] && messageReactions[msg.id].length > 0 ? '20px' : '10px'
                                                            }}
                                                            onContextMenu={(e) => handleMessageContextMenu(msg, e)}
                                                            onTouchStart={(e) => handleTouchStart(msg, e)}
                                                            onTouchMove={handleTouchMove}
                                                            onTouchEnd={handleTouchEnd}
                                                            onTouchCancel={handleTouchEnd}
                                                            onClick={(e) => {
                                                                // Prevent navigation if message contains a URL
                                                                if (msg.text && (msg.text.includes('http://') || msg.text.includes('https://'))) {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                }
                                                            }}
                                                        >
                                                            {/* Reply Preview - screenshot when replying to shared post (MP4/image) */}
                                                            {msg.replyTo && (
                                                                <div className="mb-2 pb-2 border-l-2 border-white/30 pl-2 -mx-2">
                                                                    <div className="flex items-start gap-2">
                                                                        {msg.replyTo.imageUrl && (
                                                                            <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 border border-white/20 bg-black">
                                                                                {(msg.replyTo as { mediaType?: 'image' | 'video' }).mediaType === 'video' ? (
                                                                                    <video src={msg.replyTo.imageUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                                                                                ) : (
                                                                                    <img src={msg.replyTo.imageUrl} alt="Reply preview" className="w-full h-full object-cover" />
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="text-xs text-white/70 font-medium mb-0.5">{msg.replyTo.senderHandle}</div>
                                                                            <div className="text-xs text-white/60 truncate">
                                                                                {msg.replyTo.imageUrl
                                                                                    ? ((msg.replyTo as { mediaType?: 'image' | 'video' }).mediaType === 'video' ? 'Video' : 'Photo')
                                                                                    : (msg.replyTo.text || 'Message')}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {msg.imageUrl && (
                                                                <div className="relative mb-2 -mx-2 -mt-2 first:mt-0">
                                                                    <img src={msg.imageUrl} alt="Sent image" className="max-w-full rounded-t-2xl rounded-tr-sm" />
                                                                    {msg.imageUrl && wasEverAStory(msg.imageUrl) && storyActiveByUrl[msg.imageUrl] === false && (
                                                                        <div className="absolute inset-0 bg-black/50 rounded-t-2xl rounded-tr-sm flex items-center justify-center">
                                                                            <span className="text-[10px] text-white/90 px-2 py-1 rounded">Story unavailable</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {msg.audioUrl && (
                                                                <div className="mb-2 -mx-2 -mt-2 first:mt-0 flex items-center gap-2 p-3 bg-black/20 rounded-lg">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const audio = new Audio(msg.audioUrl);
                                                                            audio.play().catch(err => console.error('Error playing audio:', err));
                                                                        }}
                                                                        className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                                                                    >
                                                                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.383 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.383l4.617-3.793a1 1 0 011.383.07zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-1.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                                                                        </svg>
                                                                    </button>
                                                                    <div className="flex-1">
                                                                        <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                                                                            <div className="h-full bg-white/60 rounded-full" style={{ width: '60%' }}></div>
                                                                        </div>
                                                                        <span className="text-xs text-white/70 mt-1 block">Voice message</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {msg.text && (
                                                                <div>
                                                                    <p className="text-white text-sm leading-relaxed select-none" style={{ WebkitUserSelect: 'none', userSelect: 'none' }}>
                                                                        {translatedMessages[msg.id] || msg.text}
                                                                    </p>
                                                                    {translatedMessages[msg.id] && (
                                                                        <p className="text-white/60 text-xs mt-1 italic select-none" style={{ WebkitUserSelect: 'none', userSelect: 'none' }}>
                                                                            Original: {msg.text}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {/* Reactions - Instagram-style: red heart only, no white bg; pop animation */}
                                                            {messageReactions[msg.id] && messageReactions[msg.id].length > 0 && (
                                                                <div className="absolute bottom-0 right-0 flex items-center gap-0.5 mb-1 mr-1">
                                                                    {messageReactions[msg.id].map((reaction, idx) => {
                                                                        const isHeart = reaction.emoji === '❤️';
                                                                        return (
                                                                            <button
                                                                                key={`${idx}-${reaction.emoji}-${reaction.users.length}-${reaction.users.join('-')}`}
                                                                                data-reaction-message-id={msg.id}
                                                                                data-reaction-emoji={reaction.emoji}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleAddReaction(msg.id, reaction.emoji);
                                                                                }}
                                                                                className={
                                                                                    isHeart
                                                                                        ? 'rounded-full px-1 py-0.5 flex items-center gap-1 transition-colors animate-reaction-heart-pop'
                                                                                        : 'bg-white/90 hover:bg-white rounded-full px-1.5 py-0.5 flex items-center gap-1 shadow-sm transition-colors'
                                                                                }
                                                                                title={`${reaction.users.length} ${reaction.users.length === 1 ? 'reaction' : 'reactions'}`}
                                                                            >
                                                                                {isHeart ? (
                                                                                    <span className="inline-flex items-center justify-center text-base leading-none" aria-label="heart">
                                                                                        <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                                                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                                                                        </svg>
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-sm leading-none">{reaction.emoji}</span>
                                                                                )}
                                                                                {reaction.users.length > 1 && (
                                                                                    <span className={`text-[10px] font-medium leading-none ${isHeart ? 'text-red-400' : 'text-gray-700'}`}>{reaction.users.length}</span>
                                                                                )}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                            </div>
                                                            {/* Read receipt and timestamp */}
                                                            <div className="flex items-center gap-1.5 px-1">
                                                                <span className="text-[10px] text-gray-400">
                                                                    {formatTimestamp(msg.timestamp)}
                                                                </span>
                                                                {msg.edited && (
                                                                    <span className="text-[10px] text-gray-500 italic">edited</span>
                                                                )}
                                                                {/* Read receipt - double checkmark (sent), filled (delivered), blue (read) */}
                                                                <div className="flex items-center">
                                                                    <svg className={`w-3.5 h-3.5 ${msg.read ? 'text-blue-400' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                    </svg>
                                                                    <svg className={`w-3.5 h-3.5 -ml-1.5 ${msg.read ? 'text-blue-400' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()
                                        ) : (
                                            (() => {
                                                // Check if this is a comment notification
                                                const commentPostId = msg.postId;
                                                const commentPost = commentPostId ? sharedPosts[commentPostId] : null;
                                                const commentText = msg.commentText;
                                                
                                                // Debug logging
                                                if (commentPostId) {
                                                    console.log('Comment notification detected:', { 
                                                        commentPostId, 
                                                        commentText, 
                                                        hasPost: !!commentPost,
                                                        messageId: msg.id 
                                                    });
                                                }
                                                
                                                // If it's a comment notification with post and comment text, show CommentCard
                                                if (commentPost && commentText) {
                                                    console.log('Rendering CommentCard for:', commentPostId);
                                                    return (
                                                        <div className="flex items-start gap-2 w-full mb-2" style={{ maxWidth: '100%' }}>
                                                            {msg.senderAvatar && (
                                                                <Avatar
                                                                    src={msg.senderAvatar}
                                                                    name={msg.senderHandle}
                                                                    size="sm"
                                                                />
                                                            )}
                                                            <div className="flex-1 min-w-0" style={{ maxWidth: '448px' }}>
                                                                <CommentCard 
                                                                    post={commentPost} 
                                                                    commentText={commentText}
                                                                    commenterHandle={msg.senderHandle}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                
                                                // If comment post is loading
                                                if (commentPostId && !commentPost) {
                                                    return (
                                                        <div className="flex items-start gap-2 w-full mb-2" style={{ maxWidth: '100%' }}>
                                                            {msg.senderAvatar && (
                                                                <Avatar
                                                                    src={msg.senderAvatar}
                                                                    name={msg.senderHandle}
                                                                    size="sm"
                                                                />
                                                            )}
                                                            <div className="flex-1 min-w-0" style={{ maxWidth: '448px' }}>
                                                                <div className="w-full max-w-md rounded-2xl overflow-hidden bg-gray-800 border border-gray-700 shadow-lg p-4">
                                                                    <div className="flex items-center justify-center py-8">
                                                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                
                                                // Check postId field first, then extract from text
                                                const postId = msg.postId || (msg.text ? extractPostId(msg.text) : null);
                                                const sharedPost = postId ? sharedPosts[postId] : null;
                                                
                                                // Debug logging
                                                if (postId && !sharedPost) {
                                                    console.log('Post ID detected but not yet loaded:', postId, 'from field:', !!msg.postId, 'from text:', !msg.postId);
                                                }
                                                if (sharedPost) {
                                                    console.log('Rendering SharedPostCard for post:', sharedPost.id, 'isTextOnly:', !sharedPost.mediaUrl && (!sharedPost.mediaItems || sharedPost.mediaItems.length === 0) && sharedPost.text);
                                                }
                                                
                                                // If it's a shared post, render outside the bubble (tappable → Scenes); long-press opens react card
                                                if (sharedPost) {
                                                    return (
                                                        <div className="flex items-start gap-2 w-full mb-2" style={{ maxWidth: '100%' }}>
                                                            {msg.senderAvatar && (
                                                                <Avatar
                                                                    src={msg.senderAvatar}
                                                                    name={msg.senderHandle}
                                                                    size="sm"
                                                                />
                                                            )}
                                                            <div data-message-bubble-id={msg.id} className="relative flex-1 min-w-0" style={{ maxWidth: '448px' }} onContextMenu={(e) => { e.preventDefault(); handleMessageContextMenu(msg, e); }} onTouchStart={(e) => handleTouchStart(msg, e)} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchEnd}>
                                                                <SharedPostCard post={sharedPost} onTap={openScenesForPost} />
                                                                {messageReactions[msg.id]?.length > 0 && (
                                                                    <div className="absolute bottom-2 right-2 flex items-center gap-0.5">
                                                                        {messageReactions[msg.id].map((reaction, idx) => {
                                                                            const isHeart = reaction.emoji === '❤️';
                                                                            return (
                                                                                <button key={`${idx}-${reaction.emoji}`} data-reaction-message-id={msg.id} data-reaction-emoji={reaction.emoji} onClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); handleAddReaction(msg.id, reaction.emoji); }} className={isHeart ? 'rounded-full px-1 py-0.5 flex items-center gap-1' : 'bg-white/90 rounded-full px-1.5 py-0.5 flex items-center gap-1 shadow-sm'}>
                                                                                    {isHeart ? <span className="text-red-500"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg></span> : <span className="text-sm">{reaction.emoji}</span>}
                                                                                    {reaction.users.length > 1 && <span className="text-[10px] font-medium text-gray-600">{reaction.users.length}</span>}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                
                                                // Post ID detected but not loaded: show preview card, tap to view in Scenes; long-press opens react card
                                                if (postId && !sharedPost) {
                                                    return (
                                                        <div className="flex items-start gap-2 w-full mb-2" style={{ maxWidth: '100%' }}>
                                                            {msg.senderAvatar && (
                                                                <Avatar
                                                                    src={msg.senderAvatar}
                                                                    name={msg.senderHandle}
                                                                    size="sm"
                                                                />
                                                            )}
                                                            <div data-message-bubble-id={msg.id} className="relative flex-1 min-w-0" style={{ maxWidth: '448px' }} onContextMenu={(e) => { e.preventDefault(); handleMessageContextMenu(msg, e); }} onTouchStart={(e) => handleTouchStart(msg, e)} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchEnd}>
                                                                <SharedPostPreviewCard postId={postId} onTap={() => openScenesForPostId(postId)} userId={user?.id} />
                                                                {messageReactions[msg.id]?.length > 0 && (
                                                                    <div className="absolute bottom-2 right-2 flex items-center gap-0.5">
                                                                        {messageReactions[msg.id].map((reaction, idx) => {
                                                                            const isHeart = reaction.emoji === '❤️';
                                                                            return (
                                                                                <button key={`${idx}-${reaction.emoji}`} data-reaction-message-id={msg.id} data-reaction-emoji={reaction.emoji} onClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); handleAddReaction(msg.id, reaction.emoji); }} className={isHeart ? 'rounded-full px-1 py-0.5 flex items-center gap-1' : 'bg-white/90 rounded-full px-1.5 py-0.5 flex items-center gap-1 shadow-sm'}>
                                                                                    {isHeart ? <span className="text-red-500"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg></span> : <span className="text-sm">{reaction.emoji}</span>}
                                                                                    {reaction.users.length > 1 && <span className="text-[10px] font-medium text-gray-600">{reaction.users.length}</span>}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                
                                                // Check if this is a question message (from someone asking a question)
                                                const questionData = parseQuestionMessage(msg.text);
                                                
                                                // If it's a question message, show special UI with reply button
                                                if (questionData) {
                                                    return (
                                                        <div className="flex items-start gap-2 w-full mb-2" style={{ maxWidth: '100%' }}>
                                                            {msg.senderAvatar && (
                                                                <Avatar
                                                                    src={msg.senderAvatar}
                                                                    name={msg.senderHandle}
                                                                    size="sm"
                                                                />
                                                            )}
                                                            <div className="flex-1 min-w-0" style={{ maxWidth: '448px' }}>
                                                                <div className="bg-gray-800 rounded-2xl p-4 border border-purple-500/50">
                                                                    <div className="mb-3">
                                                                        <p className="text-xs text-gray-400 mb-1 font-semibold">Question:</p>
                                                                        <p className="text-white font-semibold text-sm">{questionData.question}</p>
                                                                    </div>
                                                                    <div className="mb-3">
                                                                        <p className="text-xs text-gray-400 mb-1 font-semibold">Answer from {msg.senderHandle}:</p>
                                                                        <p className="text-white text-sm">{questionData.answer}</p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            navigate('/clip', {
                                                                                state: {
                                                                                    replyToQuestion: {
                                                                                        question: questionData.question,
                                                                                        response: questionData.answer,
                                                                                        responderHandle: msg.senderHandle
                                                                                    }
                                                                                }
                                                                            });
                                                                        }}
                                                                        className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:opacity-90 transition-opacity text-sm"
                                                                    >
                                                                        Reply in Story
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                
                                                // Regular message - render in bubble (only if not a post URL or comment notification)
                                                // Don't show text if it's a comment notification (we show CommentCard instead)
                                                if (commentPostId && !commentPost) {
                                                    // Still loading, already handled above
                                                    return null;
                                                }
                                                
                                                // Don't show text if it's a post URL (we show SharedPostCard or loading state instead)
                                                if (postId) {
                                                    // Post URL detected - already handled above with SharedPostCard or loading state
                                                    return null;
                                                }
                                                
                                                // Also check if text contains a post URL pattern - if so, don't show the text
                                                // (it might be loading or the postId wasn't set properly)
                                                const hasPostUrlPattern = msg.text && (
                                                    msg.text.includes('/post/') || 
                                                    msg.text.includes('http://') || 
                                                    msg.text.includes('https://')
                                                );
                                                
                                                if (hasPostUrlPattern && !postId) {
                                                    // URL detected but no postId - try to extract it and fetch
                                                    const extractedPostId = extractPostId(msg.text || '');
                                                    if (extractedPostId) {
                                                        // If we already have the post, render it (tappable → Scenes); long-press opens react card
                                                        if (sharedPosts[extractedPostId]) {
                                                            return (
                                                                <div className="flex items-start gap-2 w-full mb-2" style={{ maxWidth: '100%' }}>
                                                                    {msg.senderAvatar && (
                                                                        <Avatar src={msg.senderAvatar} name={msg.senderHandle} size="sm" />
                                                                    )}
                                                                    <div data-message-bubble-id={msg.id} className="relative flex-1 min-w-0" style={{ maxWidth: '448px' }} onContextMenu={(e) => { e.preventDefault(); handleMessageContextMenu(msg, e); }} onTouchStart={(e) => handleTouchStart(msg, e)} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchEnd}>
                                                                        <SharedPostCard post={sharedPosts[extractedPostId]} onTap={openScenesForPost} />
                                                                        {messageReactions[msg.id]?.length > 0 && (
                                                                            <div className="absolute bottom-2 right-2 flex items-center gap-0.5">
                                                                                {messageReactions[msg.id].map((reaction, idx) => {
                                                                                    const isHeart = reaction.emoji === '❤️';
                                                                                    return (
                                                                                        <button key={`${idx}-${reaction.emoji}`} data-reaction-message-id={msg.id} data-reaction-emoji={reaction.emoji} onClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); handleAddReaction(msg.id, reaction.emoji); }} className={isHeart ? 'rounded-full px-1 py-0.5 flex items-center gap-1' : 'bg-white/90 rounded-full px-1.5 py-0.5 flex items-center gap-1 shadow-sm'}>
                                                                                            {isHeart ? <span className="text-red-500"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg></span> : <span className="text-sm">{reaction.emoji}</span>}
                                                                                            {reaction.users.length > 1 && <span className="text-[10px] font-medium text-gray-600">{reaction.users.length}</span>}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        if (!sharedPosts[extractedPostId]) {
                                                            getPostById(extractedPostId, user?.id).then(post => { if (post) setSharedPosts(prev => ({ ...prev, [extractedPostId]: post })); }).catch(() => {});
                                                        }
                                                        return (
                                                            <div className="flex items-start gap-2 w-full mb-2" style={{ maxWidth: '100%' }}>
                                                                {msg.senderAvatar && (
                                                                    <Avatar src={msg.senderAvatar} name={msg.senderHandle} size="sm" />
                                                                )}
                                                                <div data-message-bubble-id={msg.id} className="relative flex-1 min-w-0" style={{ maxWidth: '448px' }} onContextMenu={(e) => { e.preventDefault(); handleMessageContextMenu(msg, e); }} onTouchStart={(e) => handleTouchStart(msg, e)} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchEnd}>
                                                                    <SharedPostPreviewCard postId={extractedPostId} onTap={() => openScenesForPostId(extractedPostId)} userId={user?.id} />
                                                                    {messageReactions[msg.id]?.length > 0 && (
                                                                        <div className="absolute bottom-2 right-2 flex items-center gap-0.5">
                                                                            {messageReactions[msg.id].map((reaction, idx) => {
                                                                                const isHeart = reaction.emoji === '❤️';
                                                                                return (
                                                                                    <button key={`${idx}-${reaction.emoji}`} data-reaction-message-id={msg.id} data-reaction-emoji={reaction.emoji} onClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); handleAddReaction(msg.id, reaction.emoji); }} className={isHeart ? 'rounded-full px-1 py-0.5 flex items-center gap-1' : 'bg-white/90 rounded-full px-1.5 py-0.5 flex items-center gap-1 shadow-sm'}>
                                                                                        {isHeart ? <span className="text-red-500"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg></span> : <span className="text-sm">{reaction.emoji}</span>}
                                                                                        {reaction.users.length > 1 && <span className="text-[10px] font-medium text-gray-600">{reaction.users.length}</span>}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                }
                                                
                                                return (
                                                    <div className="flex items-start gap-2 max-w-[75%]">
                                                        {msg.senderAvatar && (
                                                            <Avatar
                                                                src={msg.senderAvatar}
                                                                name={msg.senderHandle}
                                                                size="sm"
                                                                className="flex-shrink-0"
                                                            />
                                                        )}
                                                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                                            <div
                                                                data-message-bubble-id={msg.id}
                                                                className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-2.5 break-words cursor-pointer select-none shadow-sm relative"
                                                                style={{
                                                                    maxWidth: '100%',
                                                                    wordBreak: 'break-word',
                                                                    overflowWrap: 'break-word',
                                                                    transform: swipingMessageId === msg.id ? `translateX(${swipeOffset}px)` : 'translateX(0)',
                                                                    transition: swipeOffset === 0 ? 'transform 0.2s' : 'none',
                                                                    paddingBottom: messageReactions[msg.id] && messageReactions[msg.id].length > 0 ? '20px' : '10px'
                                                                }}
                                                                onContextMenu={(e) => handleMessageContextMenu(msg, e)}
                                                                onTouchStart={(e) => handleTouchStart(msg, e)}
                                                                onTouchMove={handleTouchMove}
                                                                onTouchEnd={handleTouchEnd}
                                                                onTouchCancel={handleTouchEnd}
                                                                onClick={(e) => {
                                                                    // Prevent navigation if message contains a URL
                                                                    if (msg.text && (msg.text.includes('http://') || msg.text.includes('https://'))) {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                    }
                                                                }}
                                                            >
                                                                {/* Reply Preview - Instagram style */}
                                                                {msg.replyTo && (
                                                                    <div className="mb-2 pb-2 border-l-2 border-white/30 pl-2 -mx-2">
                                                                        <div className="flex items-start gap-2">
                                                                            {msg.replyTo.imageUrl && (
                                                                                <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 border border-white/20 bg-black">
                                                                                    {(msg.replyTo as { mediaType?: 'image' | 'video' }).mediaType === 'video' ? (
                                                                                        <video src={msg.replyTo.imageUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                                                                                    ) : (
                                                                                        <img src={msg.replyTo.imageUrl} alt="Reply preview" className="w-full h-full object-cover" />
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="text-xs text-white/70 font-medium mb-0.5">{msg.replyTo.senderHandle}</div>
                                                                                <div className="text-xs text-white/60 truncate">
                                                                                    {msg.replyTo.imageUrl
                                                                                        ? ((msg.replyTo as { mediaType?: 'image' | 'video' }).mediaType === 'video' ? 'Video' : 'Photo')
                                                                                        : (msg.replyTo.text || 'Message')}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {msg.imageUrl && (
                                                                    <div className="relative mb-2 -mx-2 -mt-2 first:mt-0">
                                                                        <img src={msg.imageUrl} alt="Received image" className="max-w-full rounded-t-2xl rounded-tl-sm" />
                                                                        {msg.imageUrl && wasEverAStory(msg.imageUrl) && storyActiveByUrl[msg.imageUrl] === false && (
                                                                            <div className="absolute inset-0 bg-black/50 rounded-t-2xl rounded-tl-sm flex items-center justify-center">
                                                                                <span className="text-[10px] text-white/90 px-2 py-1 rounded">Story unavailable</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {msg.audioUrl && (
                                                                    <div className="mb-2 -mx-2 -mt-2 first:mt-0 flex items-center gap-2 p-3 bg-white/10 rounded-lg">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const audio = new Audio(msg.audioUrl);
                                                                                audio.play().catch(err => console.error('Error playing audio:', err));
                                                                            }}
                                                                            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                                                                        >
                                                                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.383 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.383l4.617-3.793a1 1 0 011.383.07zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-1.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                                                                            </svg>
                                                                        </button>
                                                                        <div className="flex-1">
                                                                            <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                                                                                <div className="h-full bg-white/60 rounded-full" style={{ width: '60%' }}></div>
                                                                            </div>
                                                                            <span className="text-xs text-white/70 mt-1 block">Voice message</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {msg.text && !commentPostId && (
                                                                    <div>
                                                                        <p className="text-white text-sm leading-relaxed select-none" style={{ WebkitUserSelect: 'none', userSelect: 'none' }}>
                                                                            {translatedMessages[msg.id] || msg.text}
                                                                        </p>
                                                                        {translatedMessages[msg.id] && (
                                                                            <p className="text-white/60 text-xs mt-1 italic select-none" style={{ WebkitUserSelect: 'none', userSelect: 'none' }}>
                                                                                Original: {msg.text}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {/* Reactions - Instagram-style: red heart only, no white bg; pop animation */}
                                                                {messageReactions[msg.id] && messageReactions[msg.id].length > 0 && (
                                                                    <div className="absolute bottom-0 right-0 flex items-center gap-0.5 mb-1 mr-1">
                                                                        {messageReactions[msg.id].map((reaction, idx) => {
                                                                            const isHeart = reaction.emoji === '❤️';
                                                                            return (
                                                                                <button
                                                                                    key={`${idx}-${reaction.emoji}-${reaction.users.length}-${reaction.users.join('-')}`}
                                                                                    data-reaction-message-id={msg.id}
                                                                                    data-reaction-emoji={reaction.emoji}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleAddReaction(msg.id, reaction.emoji);
                                                                                    }}
                                                                                    className={
                                                                                        isHeart
                                                                                            ? 'rounded-full px-1 py-0.5 flex items-center gap-1 transition-colors animate-reaction-heart-pop'
                                                                                            : 'bg-white/90 hover:bg-white rounded-full px-1.5 py-0.5 flex items-center gap-1 shadow-sm transition-colors'
                                                                                    }
                                                                                    title={`${reaction.users.length} ${reaction.users.length === 1 ? 'reaction' : 'reactions'}`}
                                                                                >
                                                                                    {isHeart ? (
                                                                                        <span className="inline-flex items-center justify-center text-base leading-none" aria-label="heart">
                                                                                            <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                                                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                                                                            </svg>
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-sm leading-none">{reaction.emoji}</span>
                                                                                    )}
                                                                                    {reaction.users.length > 1 && (
                                                                                        <span className={`text-[10px] font-medium leading-none ${isHeart ? 'text-red-400' : 'text-gray-700'}`}>{reaction.users.length}</span>
                                                                                    )}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                                </div>
                                                            {/* Timestamp */}
                                                            <div className="flex items-center gap-1.5 px-1">
                                                                <span className="text-[10px] text-gray-400">
                                                                    {formatTimestamp(msg.timestamp)}
                                                                </span>
                                                                {msg.edited && (
                                                                    <span className="text-[10px] text-gray-500 italic">edited</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()
                                        )}
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                    
                    {/* Typing Indicator */}
                    {isTyping && (
                        <div className="flex items-start gap-2 max-w-[75%]">
                            <Avatar
                                src={otherUserAvatar}
                                name={handle || ''}
                                size="sm"
                                className="flex-shrink-0"
                            />
                            <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Input Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-20">
                {/* Reply Preview - show screenshot/thumbnail when replying to shared post (MP4 or image) */}
                {replyingTo && (() => {
                    const replyPostId = replyingTo.postId || extractPostId(replyingTo.text || '');
                    const replyPost = replyPostId ? sharedPosts[replyPostId] : null;
                    const replyThumbUrl = replyingTo.imageUrl || replyPost?.mediaUrl;
                    const isVideoReply = replyPost?.mediaType === 'video';
                    return (
                        <div className="px-4 pt-3 pb-2 border-b border-gray-800 bg-gray-800/50">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="w-0.5 h-12 bg-[#0095f6] rounded-full flex-shrink-0" />
                                    {replyThumbUrl && (
                                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-700 bg-black">
                                            {isVideoReply ? (
                                                <video src={replyThumbUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                                            ) : (
                                                <img src={replyThumbUrl} alt="Reply preview" className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs text-gray-400 mb-0.5">Replying to {replyingTo.senderHandle}</div>
                                        <div className="text-sm text-gray-300 truncate">
                                            {replyThumbUrl ? (isVideoReply ? 'Video' : 'Photo') : (replyingTo.text || 'Message')}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleCancelReply}
                                    className="p-1 hover:bg-gray-700 rounded-full transition-colors flex-shrink-0"
                                >
                                    <FiX className="w-4 h-4 text-gray-400" />
                                </button>
                            </div>
                        </div>
                    );
                })()}
                {/* Edit Preview */}
                {editingMessage && (
                    <div className="px-4 pt-3 pb-2 border-b border-gray-800 bg-gray-800/50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-xs text-gray-400">Editing message</span>
                            </div>
                            <button
                                onClick={handleCancelEdit}
                                className="p-1 hover:bg-gray-700 rounded-full transition-colors flex-shrink-0"
                            >
                                <FiX className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>
                    </div>
                )}
                {/* Image compose: preview + caption before sending */}
                {imageCompose && (
                    <div className="px-3 py-2 sm:px-4 border-b border-gray-800 bg-gray-800/50">
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-700">
                                <img src={imageCompose.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                                <input
                                    type="text"
                                    value={imageCompose.caption}
                                    onChange={(e) => setImageCompose(prev => prev ? { ...prev, caption: e.target.value } : null)}
                                    placeholder="Add a caption..."
                                    className="w-full bg-gray-700 text-white placeholder-gray-400 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-white"
                                    autoFocus
                                />
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleSendImageWithCaption}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0095f6] text-white text-sm font-medium hover:bg-[#0084d4] transition-colors"
                                    >
                                        <FiSend className="w-4 h-4" />
                                        Send
                                    </button>
                                    <button
                                        onClick={handleCancelImageCompose}
                                        className="p-1.5 hover:bg-gray-700 rounded-full transition-colors text-gray-400"
                                        aria-label="Cancel"
                                    >
                                        <FiX className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
                    {!messageText.trim() && (
                        <button
                            onClick={handleImageClick}
                            className="p-2 hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
                        >
                            <IoMdPhotos className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                        </button>
                    )}
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                        <input
                            type="text"
                            value={messageText}
                            onChange={(e) => {
                                setMessageText(e.target.value);
                                // Simulate typing indicator (in real app, this would be sent to server)
                                // For now, we'll just show it when user is typing
                            }}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleSend();
                                }
                            }}
                            placeholder={editingMessage ? "Edit message..." : replyingTo ? "Message..." : "Message..."}
                            className="flex-1 bg-gray-800 text-white placeholder-gray-500 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full focus:outline-none focus:ring-2 focus:ring-white text-sm sm:text-base min-w-0"
                        />
                        {messageText.trim() && (
                            <button
                                onClick={handleSend}
                                className="text-[#0095f6] hover:text-[#0084d4] transition-colors flex-shrink-0"
                            >
                                <FiSend className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        )}
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        accept="image/*"
                        className="hidden"
                    />
                </div>
            </div>

            {/* Context Menu - position above tap when near bottom so full card is visible */}
            {contextMenu && (() => {
                const menuHeightEstimate = 420;
                const padding = 16;
                const showAbove = contextMenu.y + menuHeightEstimate > window.innerHeight - padding;
                const top = showAbove
                    ? Math.max(padding, contextMenu.y - menuHeightEstimate - 10)
                    : contextMenu.y - 10;
                const transform = showAbove ? 'translate(-50%, 0)' : 'translate(-50%, -10px)';
                return (
                <div
                    className="fixed bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 min-w-[200px] max-h-[calc(100vh-32px)] overflow-y-auto"
                    style={{
                        left: `${contextMenu.x}px`,
                        top: `${top}px`,
                        transform
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="py-2">
                        {/* Timestamp */}
                        {contextMenu.message && (
                            <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-700">
                                {formatTimestamp(contextMenu.message.timestamp)}
                            </div>
                        )}

                        {/* Menu Items */}
                        {contextMenu.message?.isFromMe && (
                            <button
                                onClick={handleEditMessage}
                                className="w-full text-left px-4 py-3 hover:bg-gray-800 flex items-center gap-3 text-white"
                            >
                                <FiEdit3 className="w-5 h-5" />
                                <span>Edit</span>
                            </button>
                        )}
                        <button
                            onClick={handleReply}
                            className="w-full text-left px-4 py-3 hover:bg-gray-800 flex items-center gap-3 text-white"
                        >
                            <FiCornerUpLeft className="w-5 h-5" />
                            <span>Reply</span>
                        </button>
                        <button
                            onClick={() => {
                                if (contextMenu?.message) {
                                    handleAddReaction(contextMenu.message.id, '❤️');
                                    setStickerReactionAnimation({ messageId: contextMenu.message.id, emoji: '❤️', phase: 'pop' });
                                }
                                closeContextMenu();
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-800 flex items-center gap-3 text-white"
                        >
                            <span className="text-lg">❤️</span>
                            <span>React</span>
                        </button>
                        <button
                            onClick={() => {
                                if (contextMenu?.message) {
                                    setMessageForSticker(contextMenu.message);
                                }
                                setShowStickerPicker(true);
                                closeContextMenu();
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-800 flex items-center gap-3 text-white"
                        >
                            <MdStickyNote2 className="w-5 h-5" />
                            <span>Add sticker</span>
                        </button>

                        <button
                            onClick={handleForward}
                            className="w-full text-left px-4 py-3 hover:bg-gray-800 flex items-center gap-3 text-white"
                        >
                            <FaPaperPlane className="w-5 h-5" />
                            <span>Forward</span>
                        </button>

                        <button
                            onClick={handleTranslate}
                            className="w-full text-left px-4 py-3 hover:bg-gray-800 flex items-center gap-3 text-white"
                        >
                            <MdTranslate className="w-5 h-5" />
                            <span>Translate</span>
                        </button>

                        <button
                            onClick={handleReport}
                            className="w-full text-left px-4 py-3 hover:bg-gray-800 flex items-center gap-3 text-red-500 border-t border-gray-700"
                        >
                            <FaExclamationCircle className="w-5 h-5" />
                            <span>Report</span>
                        </button>

                        <button
                            onClick={() => {
                                // Show additional options
                                if (contextMenu?.message) {
                                    const msg = contextMenu.message;
                                    // Options: Pin message, Save message, etc.
                                    const options = [
                                        { label: 'Pin Message', action: () => showToast('Message pinned') },
                                        { label: 'Save Message', action: () => showToast('Message saved') },
                                        { label: 'Select Messages', action: () => showToast('Select mode enabled') },
                                    ];
                                    
                                    // For now, just show a toast - could expand to a submenu
                                    showToast('More options coming soon');
                                }
                                closeContextMenu();
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-800 flex items-center gap-3 text-white"
                        >
                            <FiMoreHorizontal className="w-5 h-5" />
                            <span>More</span>
                        </button>
                    </div>
                </div>
                );
            })()}

            {/* Sticker Picker Modal */}
            {showStickerPicker && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
                    onClick={() => { messageForStickerRef.current = null; setShowStickerPicker(false); setMessageForSticker(null); }}
                >
                    <div
                        className="bg-gray-900 rounded-t-3xl w-full max-w-md max-h-[60vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
                            <h3 className="text-white font-semibold">Add Sticker</h3>
                            <button
                                onClick={() => { messageForStickerRef.current = null; setShowStickerPicker(false); setMessageForSticker(null); }}
                                className="text-gray-400 hover:text-white"
                            >
                                <FiChevronLeft className="w-6 h-6 rotate-180" />
                            </button>
                        </div>

                        <div className="p-4 grid grid-cols-4 gap-4">
                            {/* Common Emoji Stickers */}
                            {['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'].map((emoji) => (
                                <button
                                    key={emoji}
                                    onClick={() => handleSendSticker(emoji)}
                                    className="text-4xl hover:bg-gray-800 rounded-2xl p-4 transition-colors flex items-center justify-center aspect-square"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>

                        {/* Additional sticker categories */}
                        <div className="p-4 border-t border-gray-700">
                            <h4 className="text-white font-semibold mb-3">Hearts</h4>
                            <div className="grid grid-cols-6 gap-3">
                                {['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'].map((emoji) => (
                                    <button
                                        key={emoji}
                                        onClick={() => handleSendSticker(emoji)}
                                        className="text-3xl hover:bg-gray-800 rounded-xl p-3 transition-colors flex items-center justify-center aspect-square"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-700">
                            <h4 className="text-white font-semibold mb-3">Gestures</h4>
                            <div className="grid grid-cols-6 gap-3">
                                {['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '🤙', '👌', '🤌', '🤏', '👇', '☝️', '👆', '👈', '👉', '👋', '🤚', '🖐', '✋', '🖖', '👏', '🙌', '🤲', '🤝', '🙏'].map((emoji) => (
                                    <button
                                        key={emoji}
                                        onClick={() => handleSendSticker(emoji)}
                                        className="text-3xl hover:bg-gray-800 rounded-xl p-3 transition-colors flex items-center justify-center aspect-square"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sticker reaction pop → fly-to-card animation */}
            {stickerReactionAnimation && (
                <>
                    <style dangerouslySetInnerHTML={{ __html: [
                        '@keyframes sticker-pop-big{',
                        '0%{transform:translate(-50%,-50%) scale(0.4);opacity:.9}',
                        '70%{transform:translate(-50%,-50%) scale(2.9);opacity:1}',
                        '100%{transform:translate(-50%,-50%) scale(2.5);opacity:1}',
                        '}'
                    ].join('') }} />
                    <div className="fixed inset-0 pointer-events-none z-[100]" aria-hidden>
                        <span
                            className="absolute text-[180px] leading-none select-none"
                            style={(() => {
                                const base: React.CSSProperties = { fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' };
                                if (stickerReactionAnimation.phase === 'pop') {
                                    return { ...base, left: '50%', top: '50%', transform: 'translate(-50%, -50%) scale(2.5)', animation: 'sticker-pop-big 0.35s ease-out forwards' };
                                }
                                const rect = stickerReactionAnimation.targetRect;
                                if (rect) {
                                    return { ...base, left: rect.left + rect.width / 2, top: rect.top + rect.height / 2, transform: 'translate(-50%, -50%) scale(0.35)', transition: 'transform 0.4s ease-in-out, left 0.4s ease-in-out, top 0.4s ease-in-out' };
                                }
                                return { ...base, left: '50%', top: '50%', transform: 'translate(-50%, -50%) scale(2.5)' };
                            })()}
                        >
                            {stickerReactionAnimation.emoji}
                        </span>
                    </div>
                </>
            )}

            {/* Forward Message Modal */}
            {forwardingMessage && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
                    onClick={() => {
                        setForwardingMessage(null);
                        setAvailableConversations([]);
                    }}
                >
                    <div
                        className="bg-gray-900 rounded-t-3xl w-full max-w-md max-h-[60vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
                            <h3 className="text-white font-semibold">Forward Message</h3>
                            <button
                                onClick={() => {
                                    setForwardingMessage(null);
                                    setAvailableConversations([]);
                                }}
                                className="text-gray-400 hover:text-white"
                            >
                                <FiX className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-4">
                            {availableConversations.length === 0 ? (
                                <div className="text-center text-gray-400 py-8">
                                    No other conversations to forward to
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {availableConversations.map((conv) => (
                                        <button
                                            key={conv.otherHandle}
                                            onClick={() => handleForwardToConversation(conv.otherHandle)}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-gray-800 rounded-lg transition-colors text-left"
                                        >
                                            <Avatar
                                                name={conv.otherHandle}
                                                src={getAvatarForHandle(conv.otherHandle)}
                                                size="md"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-white truncate">
                                                    {conv.otherHandle}
                                                </div>
                                                {conv.lastMessage && (
                                                    <div className="text-xs text-gray-400 truncate">
                                                        {conv.lastMessage.text || 'Photo'}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Report Message Modal */}
            {reportingMessage && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                    onClick={() => {
                        setReportingMessage(null);
                        setReportReason('');
                    }}
                >
                    <div
                        className="bg-gray-900 rounded-2xl w-full max-w-md p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-semibold text-lg">Report Message</h3>
                            <button
                                onClick={() => {
                                    setReportingMessage(null);
                                    setReportReason('');
                                }}
                                className="text-gray-400 hover:text-white"
                            >
                                <FiX className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="mb-4">
                            <p className="text-gray-400 text-sm mb-2">
                                Why are you reporting this message?
                            </p>
                            <div className="space-y-2">
                                {[
                                    'Spam',
                                    'Harassment or bullying',
                                    'Inappropriate content',
                                    'False information',
                                    'Other'
                                ].map((reason) => (
                                    <button
                                        key={reason}
                                        onClick={() => setReportReason(reason)}
                                        className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                                            reportReason === reason
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                        }`}
                                    >
                                        {reason}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setReportingMessage(null);
                                    setReportReason('');
                                }}
                                className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitReport}
                                disabled={!reportReason.trim()}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Report
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Info/Options Modal */}
            {showChatInfo && handle && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
                    onClick={() => setShowChatInfo(false)}
                >
                    <div
                        className="bg-gray-900 rounded-t-3xl w-full max-w-md max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
                            <h3 className="text-white font-semibold">Chat Info</h3>
                            <button
                                onClick={() => setShowChatInfo(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <FiX className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-4">
                            {/* User Info */}
                            <div className="flex items-center gap-4 mb-6">
                                <Avatar
                                    name={handle}
                                    src={getAvatarForHandle(handle)}
                                    size="lg"
                                />
                                <div className="flex-1">
                                    <h4 className="text-white font-semibold text-lg">{handle}</h4>
                                    <p className="text-gray-400 text-sm">Active now</p>
                                </div>
                            </div>

                            {/* Options */}
                            <div className="space-y-2">
                                <button
                                    onClick={async () => {
                                        if (!handle) return;
                                        navigate(`/user/${encodeURIComponent(handle)}`);
                                        setShowChatInfo(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-800 rounded-lg flex items-center gap-3 text-white transition-colors"
                                >
                                    <FiUserPlus className="w-5 h-5" />
                                    <span>View Profile</span>
                                </button>

                                <button
                                    onClick={async () => {
                                        if (!user?.handle || !handle) return;
                                        try {
                                            if (isMuted) {
                                                await unmuteConversation(user.handle, handle);
                                                setIsMuted(false);
                                                showToast('Notifications unmuted');
                                            } else {
                                                await muteConversation(user.handle, handle);
                                                setIsMuted(true);
                                                showToast('Notifications muted');
                                            }
                                            setShowChatInfo(false);
                                        } catch (error) {
                                            console.error('Error toggling mute:', error);
                                            showToast('Failed to update mute settings');
                                        }
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-800 rounded-lg flex items-center gap-3 text-white transition-colors"
                                >
                                    <FiMic className="w-5 h-5" />
                                    <span>{isMuted ? 'Unmute Notifications' : 'Mute Notifications'}</span>
                                </button>

                                <button
                                    onClick={async () => {
                                        if (!user?.handle || !handle) return;
                                        if (confirm(`Block ${handle}? You won't receive messages from them.`)) {
                                            try {
                                                await blockUser(user.handle, handle);
                                                showToast('User blocked');
                                                setShowChatInfo(false);
                                                navigate('/inbox');
                                            } catch (error) {
                                                console.error('Error blocking user:', error);
                                                showToast('Failed to block user');
                                            }
                                        }
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-800 rounded-lg flex items-center gap-3 text-red-500 transition-colors"
                                >
                                    <FaExclamationCircle className="w-5 h-5" />
                                    <span>Block User</span>
                                </button>

                                <button
                                    onClick={async () => {
                                        if (!user?.handle || !handle) return;
                                        if (confirm(`Delete conversation with ${handle}? This cannot be undone.`)) {
                                            try {
                                                await deleteConversation(user.handle, handle);
                                                showToast('Conversation deleted');
                                                setShowChatInfo(false);
                                                navigate('/inbox');
                                            } catch (error) {
                                                console.error('Error deleting conversation:', error);
                                                showToast('Failed to delete conversation');
                                            }
                                        }
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-800 rounded-lg flex items-center gap-3 text-red-500 transition-colors"
                                >
                                    <FiX className="w-5 h-5" />
                                    <span>Delete Conversation</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Scenes modal: tap shared post in DM to view fullscreen; close returns to DM feed */}
            {scenesOpen && selectedPostForScenes && user?.id && (
                <ScenesModal
                    post={selectedPostForScenes}
                    isOpen={scenesOpen}
                    onClose={() => {
                        setScenesOpen(false);
                        setSelectedPostForScenes(null);
                    }}
                    onLike={async () => {
                        try {
                            const updated = await toggleLike(user.id!, selectedPostForScenes.id);
                            setSelectedPostForScenes(updated);
                            setSharedPosts(prev => ({ ...prev, [updated.id]: updated }));
                        } catch (_) { /* ignore */ }
                    }}
                    onFollow={async () => {
                        try {
                            const { toggleFollow: tf } = await import('../api/client');
                            await tf(selectedPostForScenes.userHandle);
                            setSelectedPostForScenes(prev => prev ? { ...prev, isFollowing: !prev.isFollowing } : null);
                        } catch (_) { /* ignore */ }
                    }}
                    onShare={async () => {}}
                    onOpenComments={() => navigate(`/post/${selectedPostForScenes.id}`)}
                    onReclip={async () => {}}
                />
            )}
        </div>
    );
}


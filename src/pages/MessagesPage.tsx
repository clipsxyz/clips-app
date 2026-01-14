import React, { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { FiChevronLeft, FiSend, FiCornerUpLeft, FiCopy, FiMoreHorizontal, FiMapPin } from 'react-icons/fi';
import { IoMdPhotos } from 'react-icons/io';
import { BsEmojiSmile } from 'react-icons/bs';
import { FaPaperPlane, FaExclamationCircle } from 'react-icons/fa';
import { MdStickyNote2, MdTranslate } from 'react-icons/md';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { fetchConversation, appendMessage, type ChatMessage, markConversationRead } from '../api/messages';
import { getAvatarForHandle, getFlagForHandle } from '../api/users';
import { isStoryMediaActive, wasEverAStory } from '../api/stories';
import { getPostById } from '../api/posts';
import type { Post } from '../types';
import Flag from '../components/Flag';
import { timeAgo } from '../utils/timeAgo';
import { showToast } from '../utils/toast';

interface MessageUI extends ChatMessage {
    isFromMe: boolean;
    senderAvatar?: string;
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

// Component to render shared post card (matching ScenesModal format exactly - Twitter card style)
function SharedPostCard({ post }: { post: Post }) {
    // More strict check: text-only means no real mediaUrl (or empty string), no mediaItems (or empty array), and has text
    // Exclude data:image URLs (generated images) and check for real media
    const hasRealMediaUrl = post.mediaUrl && post.mediaUrl.trim() !== '' && !post.mediaUrl.startsWith('data:image');
    const hasMediaItems = post.mediaItems && post.mediaItems.length > 0;
    // If post has text and no real media, show as text-only card (Twitter style)
    // This matches ScenesModal behavior for shared text-only posts
    const isTextOnly = !!post.text && !hasRealMediaUrl && !hasMediaItems;
    
    console.log('SharedPostCard rendering:', { 
        postId: post.id, 
        isTextOnly, 
        hasRealMediaUrl,
        mediaUrl: post.mediaUrl,
        hasMediaItems,
        mediaItemsCount: post.mediaItems?.length || 0,
        hasText: !!post.text,
        text: post.text?.substring(0, 50)
    });
    
    // Always show text-only posts as white Twitter card (matching ScenesModal)
    // Force white background regardless of dark mode - use !important via inline styles
    if (isTextOnly || (post.text && !hasMediaItems)) {
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
    
    // For posts with media, show a simple preview with forced white background
    return (
        <div 
            className="w-full max-w-sm rounded-2xl overflow-hidden border shadow-lg mt-2"
            style={{
                backgroundColor: '#ffffff', // Force white background
                borderColor: '#e5e7eb' // Light gray border
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
                {post.mediaUrl && (
                    <div className="mt-2 rounded-lg overflow-hidden">
                        {post.mediaType === 'video' ? (
                            <video src={post.mediaUrl} className="w-full h-auto max-h-48 object-cover" controls />
                        ) : (
                            <img src={post.mediaUrl} alt="Post media" className="w-full h-auto max-h-48 object-cover" />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function MessagesPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { handle } = useParams<{ handle: string }>();
    const { user } = useAuth();
    const [messages, setMessages] = useState<MessageUI[]>([]);
    const [storyActiveByUrl, setStoryActiveByUrl] = useState<Record<string, boolean>>({});
    const [messageText, setMessageText] = useState('');
    
    // Store sharePostId from location.state so we can include it when sending
    const [pendingSharePostId, setPendingSharePostId] = React.useState<string | null>(null);
    
    // Check if we're coming from ShareModal with a post to share
    React.useEffect(() => {
        const state = location.state as any;
        if (state?.sharePostUrl && handle) {
            // Auto-fill the message input with the post URL
            setMessageText(state.sharePostUrl);
            // Store the postId so we can include it in the message
            if (state.sharePostId) {
                setPendingSharePostId(state.sharePostId);
            }
            // Clear the state to prevent re-triggering
            window.history.replaceState({ ...state, sharePostUrl: null, sharePostId: null }, '');
            showToast?.('Post link ready to send!');
        }
    }, [location.state, handle]);
    const [loading, setLoading] = useState(true);
    const [otherUserAvatar, setOtherUserAvatar] = useState<string | undefined>(undefined);
    const [sharedPosts, setSharedPosts] = useState<Record<string, Post>>({});
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        message: MessageUI | null;
        x: number;
        y: number;
    } | null>(null);
    const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sticker picker state
    const [showStickerPicker, setShowStickerPicker] = useState(false);

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

            if (countChanged || lastIdChanged) {
                lastMessageCountRef.current = currentCount;
                lastMessageIdRef.current = currentLastId;

                // Force scroll to bottom - use requestAnimationFrame for immediate execution
                const forceScroll = () => {
                    const el = listRef.current;
                    if (!el) return;

                    const scrollHeight = el.scrollHeight;

                    // Find the input bar element to get its actual height
                    const inputBar = document.querySelector('.fixed.bottom-0.bg-gray-900');
                    const inputBarHeight = inputBar ? inputBar.getBoundingClientRect().height : 80;

                    // Force scroll to absolute bottom - try multiple methods
                    // Method 1: Direct assignment
                    el.scrollTop = scrollHeight;

                    // Method 2: scrollTo method
                    el.scrollTo({
                        top: scrollHeight,
                        behavior: 'instant'
                    });

                    // Method 3: scrollTop assignment after a frame
                    requestAnimationFrame(() => {
                        el.scrollTop = scrollHeight;
                    });

                    // Also try scrollIntoView on last message - this is often more reliable
                    const lastMsgEl = lastMessageRef.current;
                    if (lastMsgEl) {
                        // Use scrollIntoView with block: 'end' to scroll the message into view
                        requestAnimationFrame(() => {
                            lastMsgEl.scrollIntoView({
                                behavior: 'instant',
                                block: 'end',
                                inline: 'nearest'
                            });

                            // Calculate exact scroll position to place message above input bar
                            // Use requestAnimationFrame to ensure DOM is ready
                            requestAnimationFrame(() => {
                                setTimeout(() => {
                                    const lastMsgRect = lastMsgEl.getBoundingClientRect();
                                    const containerRect = el.getBoundingClientRect();
                                    const viewportHeight = window.innerHeight;

                                    // Get the actual input bar height dynamically
                                    const inputBar = document.querySelector('.fixed.bottom-0.bg-gray-900');
                                    const actualInputBarHeight = inputBar ? inputBar.getBoundingClientRect().height : inputBarHeight;
                                    const inputBarTop = viewportHeight - actualInputBarHeight;

                                    // Calculate message position relative to container
                                    const messageTopRelative = lastMsgRect.top - containerRect.top + el.scrollTop;
                                    const messageBottomRelative = messageTopRelative + lastMsgRect.height;

                                    // Calculate visible container height (above input bar)
                                    const visibleContainerHeight = inputBarTop - containerRect.top;

                                    // We want the entire message (including its height) to be above the footer with padding
                                    // Target: message bottom should be at visibleContainerHeight - padding
                                    // But we need to account for the message's full height
                                    const padding = 150; // Extra padding above input bar to ensure full visibility (increased significantly)
                                    const targetMessageBottom = visibleContainerHeight - padding;

                                    // Calculate the exact scroll position needed
                                    // We want: messageBottomRelative - scrollTop = targetMessageBottom
                                    // So: scrollTop = messageBottomRelative - targetMessageBottom
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
                                            const finalInputBarHeight = finalInputBar ? finalInputBar.getBoundingClientRect().height : actualInputBarHeight;
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

                                                // Verify and retry multiple times if needed
                                                requestAnimationFrame(() => {
                                                    if (Math.abs(el.scrollTop - finalTargetScrollTop) > 1) {

                                                        // Try multiple scroll methods
                                                        el.scrollTop = finalTargetScrollTop;
                                                        el.scrollTo({ top: finalTargetScrollTop, behavior: 'instant' });

                                                        // Try again after a delay
                                                        setTimeout(() => {
                                                            el.scrollTop = finalTargetScrollTop;
                                                            el.scrollTo({ top: finalTargetScrollTop, behavior: 'instant' });

                                                        }, 50);
                                                    }

                                                });
                                            }
                                        }, 150);
                                    }
                                }, 50);
                            });
                        });
                    }
                };

                // Try immediately with requestAnimationFrame
                requestAnimationFrame(() => {
                    forceScroll();
                    // Try again after a short delay
                    setTimeout(forceScroll, 50);
                    setTimeout(forceScroll, 150);
                    setTimeout(forceScroll, 300);
                });
            }
        }
    }, [messages, loading]);

    // Also use MutationObserver to detect DOM changes and scroll
    React.useEffect(() => {
        const el = listRef.current;
        if (!el) return;

        const observer = new MutationObserver(() => {
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

            // Avatar is retrieved via getAvatarForHandle function
            // No need to fetch from posts

            // Mock avatar for Sarah@Artane
            if (handle === 'Sarah@Artane') {
                setOtherUserAvatar('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop');
            }
        }

        loadAvatar();

        // Load conversation from API
        if (!handle || !user?.handle) return;
        fetchConversation(user.handle, handle).then(items => {
            // Ensure ascending order by timestamp so latest is at the bottom
            const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);
            const mapped: MessageUI[] = sorted.map(m => ({
                ...m,
                isFromMe: m.senderHandle === user.handle,
                senderAvatar: m.senderHandle === user.handle ? (user.avatarUrl || getAvatarForHandle(user.handle)) : getAvatarForHandle(handle)
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
                    console.log('Fetching post:', postId);
                    const post = await getPostById(postId);
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

            fetchConversation(user!.handle!, handle!).then(items => {
                const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);
                const mapped = sorted.map(m => ({
                    ...m,
                    isFromMe: m.senderHandle === user!.handle,
                    senderAvatar: m.senderHandle === user!.handle ? (user!.avatarUrl || getAvatarForHandle(user!.handle)) : getAvatarForHandle(handle!)
                }));

                // Debug: Log new messages
                console.log('Live update - new messages:', mapped.map(m => ({
                    id: m.id,
                    sender: m.senderHandle,
                    text: m.text?.substring(0, 30),
                    postId: m.postId,
                    commentText: m.commentText,
                    isSystemMessage: m.isSystemMessage
                })));

                // Reset the refs so the useEffect will detect the change
                lastMessageCountRef.current = 0;
                lastMessageIdRef.current = null;
                setMessages(mapped);
                
                // Detect and fetch shared posts in new messages (from postId field, URLs in text, and comment notifications)
                const postIds = new Set<string>();
                mapped.forEach(msg => {
                    // Check postId field first (most reliable)
                    if (msg.postId) {
                        console.log('Live update - Found postId in message field:', msg.postId, 'commentText:', msg.commentText);
                        postIds.add(msg.postId);
                    }
                    // Also check for post URLs in text (fallback)
                    else if (msg.text) {
                        const postId = extractPostId(msg.text);
                        if (postId) {
                            console.log('Live update - Found post ID in message text:', postId);
                            postIds.add(postId);
                        }
                    }
                });
                
                console.log('Live update - Fetching posts for IDs:', Array.from(postIds));
                
                // Fetch all detected posts
                Promise.all(Array.from(postIds).map(async (postId) => {
                    try {
                        console.log('Live update - Fetching post:', postId);
                        const post = await getPostById(postId);
                        if (post) {
                            console.log('Live update - Successfully fetched post:', postId, 'userHandle:', post.userHandle);
                            setSharedPosts(prev => ({ ...prev, [postId]: post }));
                        } else {
                            console.warn('Live update - Post not found:', postId);
                        }
                    } catch (error) {
                        console.error('Live update - Failed to fetch shared post:', postId, error);
                    }
                }));

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

                const urls = Array.from(new Set(mapped.map(m => m.imageUrl).filter(Boolean) as string[]));
                Promise.all(urls.map(async (u) => [u, await isStoryMediaActive(u)] as const))
                    .then(entries => setStoryActiveByUrl(Object.fromEntries(entries)));
            });
        };
        window.addEventListener('conversationUpdated', onUpdate as any);
        return () => window.removeEventListener('conversationUpdated', onUpdate as any);
    }, [handle, user?.handle, scrollToBottom]);

    const handleSend = async () => {
        if (!messageText.trim()) return;
        if (!user?.handle || !handle) return;

        // Get postId from pendingSharePostId or extract from text
        const postId = pendingSharePostId || extractPostId(messageText);
        
        if (postId && !sharedPosts[postId]) {
            // Fetch the post immediately so it can be displayed
            getPostById(postId).then(post => {
                if (post) {
                    setSharedPosts(prev => ({ ...prev, [postId]: post }));
                }
            }).catch(error => {
                console.error('Failed to fetch shared post:', error);
            });
        }

        // Optimistically add message to state immediately for instant UI update
        const tempMessage: MessageUI = {
            id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            senderHandle: user.handle,
            text: messageText,
            timestamp: Date.now(),
            isFromMe: true,
            senderAvatar: user.avatarUrl || getAvatarForHandle(user.handle),
            isSystemMessage: false,
            postId: postId || undefined // Include postId if available
        };

        // Add message immediately to state
        setMessages(prev => {
            const sorted = [...prev, tempMessage].sort((a, b) => a.timestamp - b.timestamp);
            return sorted;
        });
        setMessageText('');
        setPendingSharePostId(null); // Clear pending postId

        // Scroll to bottom immediately
        setTimeout(() => scrollToBottom(), 100);

        // Then send to API (will update state again via event)
        // Include postId in the message so it's stored properly
        await appendMessage(user.handle, handle, { 
            text: messageText,
            postId: postId || undefined
        });
    };

    const handleSendSticker = async (sticker: string) => {
        if (!user?.handle || !handle) return;

        // Create temporary message for optimistic update
        const tempMessage: MessageUI = {
            id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            senderHandle: user.handle,
            text: sticker,
            timestamp: Date.now(),
            isFromMe: true,
            senderAvatar: user.avatarUrl || getAvatarForHandle(user.handle),
            isSystemMessage: false
        };

        // Add message immediately to state
        setMessages(prev => {
            const sorted = [...prev, tempMessage].sort((a, b) => a.timestamp - b.timestamp);
            return sorted;
        });
        setShowStickerPicker(false);

        // Scroll to bottom immediately
        setTimeout(() => scrollToBottom(), 100);

        // Then send to API (will update state again via event)
        // Notifications are created automatically in appendMessage
        await appendMessage(user.handle, handle, { text: sticker });
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

            // Optimistically add message to state immediately for instant UI update
            const tempMessage: MessageUI = {
                id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                senderHandle: user.handle,
                imageUrl: imageUrl,
                timestamp: Date.now(),
                isFromMe: true,
                senderAvatar: user.avatarUrl || getAvatarForHandle(user.handle),
                isSystemMessage: false
            };

            // Add message immediately to state
            setMessages(prev => {
                const sorted = [...prev, tempMessage].sort((a, b) => a.timestamp - b.timestamp);
                return sorted;
            });

            // Scroll to bottom immediately
            setTimeout(() => scrollToBottom(), 100);

            // Then send to API (will update state again via event)
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

    // Handle long-press start
    const handleTouchStart = (msg: MessageUI, e: React.TouchEvent) => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
        }
        longPressTimerRef.current = setTimeout(() => {
            handleMessageLongPress(msg, e);
        }, 500); // 500ms for long press
    };

    // Handle long-press end
    const handleTouchEnd = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    // Close context menu
    const closeContextMenu = () => {
        setContextMenu(null);
    };

    // Handle context menu actions
    const handleReply = () => {
        if (!contextMenu?.message) return;
        // Set reply text and focus input
        setMessageText(`Replying to: ${contextMenu.message.text || 'message'} - `);
        closeContextMenu();
    };

    const handleCopy = () => {
        if (!contextMenu?.message) return;
        const textToCopy = contextMenu.message.text || '';
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                // Could show a toast notification here
            });
        }
        closeContextMenu();
    };

    const handleForward = () => {
        if (!contextMenu?.message) return;
        // TODO: Implement forward functionality
        closeContextMenu();
    };

    const handleTranslate = () => {
        if (!contextMenu?.message) return;
        // TODO: Implement translate functionality
        closeContextMenu();
    };

    const handleReport = () => {
        if (!contextMenu?.message) return;
        // TODO: Implement report functionality
        if (confirm('Report this message?')) {
            // Report logic here
        }
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
            <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 pb-40" style={{ minHeight: 0, maxHeight: 'calc(100vh - 120px)' }}>
                <div className="space-y-3">
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
                                                
                                                // If it's a shared post, render outside the bubble
                                                if (sharedPost) {
                                                    return (
                                                        <div className="w-full flex justify-end mb-2" style={{ maxWidth: '100%' }}>
                                                            <div style={{ maxWidth: '448px', width: '100%' }}>
                                                                <SharedPostCard post={sharedPost} />
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                
                                                // If post ID is detected but post is still loading, show loading state instead of URL
                                                if (postId && !sharedPost) {
                                                    return (
                                                        <div className="w-full flex justify-end mb-2" style={{ maxWidth: '100%' }}>
                                                            <div style={{ maxWidth: '448px', width: '100%' }}>
                                                                <div className="w-full max-w-md rounded-2xl overflow-hidden bg-gray-800 border border-gray-700 shadow-lg p-4">
                                                                    <div className="flex items-center justify-center py-8">
                                                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                                                    </div>
                                                                </div>
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
                                                    const extractedPostId = extractPostId(msg.text);
                                                    if (extractedPostId) {
                                                        // If we already have the post, render it
                                                        if (sharedPosts[extractedPostId]) {
                                                            return (
                                                                <div className="w-full flex justify-end mb-2" style={{ maxWidth: '100%' }}>
                                                                    <div style={{ maxWidth: '448px', width: '100%' }}>
                                                                        <SharedPostCard post={sharedPosts[extractedPostId]} />
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        
                                                        // Otherwise, fetch the post and show loading state
                                                        if (!sharedPosts[extractedPostId]) {
                                                            getPostById(extractedPostId).then(post => {
                                                                if (post) {
                                                                    setSharedPosts(prev => ({ ...prev, [extractedPostId]: post }));
                                                                }
                                                            }).catch(error => {
                                                                console.error('Failed to fetch post from URL:', error);
                                                            });
                                                        }
                                                    }
                                                    
                                                    // Show loading state while fetching
                                                    return (
                                                        <div className="w-full flex justify-end mb-2" style={{ maxWidth: '100%' }}>
                                                            <div style={{ maxWidth: '448px', width: '100%' }}>
                                                                <div className="w-full max-w-md rounded-2xl overflow-hidden bg-gray-800 border border-gray-700 shadow-lg p-4">
                                                                    <div className="flex items-center justify-center py-8">
                                                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                
                                                return (
                                                    <div
                                                        className="bg-purple-600 rounded-2xl px-4 py-2 max-w-[70%] break-words cursor-pointer select-none"
                                                        onContextMenu={(e) => handleMessageContextMenu(msg, e)}
                                                        onTouchStart={(e) => handleTouchStart(msg, e)}
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
                                                        {msg.imageUrl && (
                                                            <div className="relative mb-2">
                                                                <img src={msg.imageUrl} alt="Sent image" className="max-w-full rounded-lg" />
                                                                {msg.imageUrl && wasEverAStory(msg.imageUrl) && storyActiveByUrl[msg.imageUrl] === false && (
                                                                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                                                                        <span className="text-[10px] text-white/90 px-2 py-1 rounded">Story unavailable</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {msg.text && <p className="text-white text-sm" style={{ userSelect: 'text' }}>{msg.text}</p>}
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
                                                
                                                // If it's a shared post, render outside the bubble
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
                                                            <div className="flex-1 min-w-0" style={{ maxWidth: '448px' }}>
                                                                <SharedPostCard post={sharedPost} />
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                
                                                // If post ID is detected but post is still loading, show loading state instead of URL
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
                                                    const extractedPostId = extractPostId(msg.text);
                                                    if (extractedPostId) {
                                                        // If we already have the post, render it
                                                        if (sharedPosts[extractedPostId]) {
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
                                                                        <SharedPostCard post={sharedPosts[extractedPostId]} />
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        
                                                        // Otherwise, fetch the post and show loading state
                                                        if (!sharedPosts[extractedPostId]) {
                                                            getPostById(extractedPostId).then(post => {
                                                                if (post) {
                                                                    setSharedPosts(prev => ({ ...prev, [extractedPostId]: post }));
                                                                }
                                                            }).catch(error => {
                                                                console.error('Failed to fetch post from URL:', error);
                                                            });
                                                        }
                                                    }
                                                    
                                                    // Show loading state while fetching
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
                                                
                                                return (
                                                    <div className="flex items-start gap-2 max-w-[70%]">
                                                        {msg.senderAvatar && (
                                                            <Avatar
                                                                src={msg.senderAvatar}
                                                                name={msg.senderHandle}
                                                                size="sm"
                                                            />
                                                        )}
                                                        <div
                                                            className="bg-gray-800 rounded-2xl px-4 py-2 break-words cursor-pointer select-none"
                                                            onContextMenu={(e) => handleMessageContextMenu(msg, e)}
                                                            onTouchStart={(e) => handleTouchStart(msg, e)}
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
                                                            {msg.imageUrl && (
                                                                <div className="relative mb-2">
                                                                    <img src={msg.imageUrl} alt="Received image" className="max-w-full rounded-lg" />
                                                                    {msg.imageUrl && wasEverAStory(msg.imageUrl) && storyActiveByUrl[msg.imageUrl] === false && (
                                                                        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                                                                            <span className="text-[10px] text-white/90 px-2 py-1 rounded">Story unavailable</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {msg.text && !commentPostId && <p className="text-white text-sm" style={{ userSelect: 'text' }}>{msg.text}</p>}
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

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 min-w-[200px]"
                    style={{
                        left: `${contextMenu.x}px`,
                        top: `${contextMenu.y}px`,
                        transform: 'translate(-50%, -10px)'
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
                        <button
                            onClick={handleReply}
                            className="w-full text-left px-4 py-3 hover:bg-gray-800 flex items-center gap-3 text-white"
                        >
                            <FiCornerUpLeft className="w-5 h-5" />
                            <span>Reply</span>
                        </button>

                        <button
                            onClick={() => {
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
                            onClick={handleCopy}
                            className="w-full text-left px-4 py-3 hover:bg-gray-800 flex items-center gap-3 text-white"
                        >
                            <FiCopy className="w-5 h-5" />
                            <span>Copy</span>
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
                            onClick={() => { /* TODO: More options */ closeContextMenu(); }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-800 flex items-center gap-3 text-white"
                        >
                            <FiMoreHorizontal className="w-5 h-5" />
                            <span>More</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Sticker Picker Modal */}
            {showStickerPicker && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
                    onClick={() => setShowStickerPicker(false)}
                >
                    <div
                        className="bg-gray-900 rounded-t-3xl w-full max-w-md max-h-[60vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
                            <h3 className="text-white font-semibold">Add Sticker</h3>
                            <button
                                onClick={() => setShowStickerPicker(false)}
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
        </div>
    );
}


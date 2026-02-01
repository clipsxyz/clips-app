import React, { useState, useEffect } from 'react';
import { FiLink, FiSearch, FiMessageCircle } from 'react-icons/fi';
import { SiFacebook, SiInstagram, SiWhatsapp, SiX, SiThreads } from 'react-icons/si';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { createStory } from '../api/stories';
import { showToast } from '../utils/toast';
import { updateMetaTags, clearMetaTags } from '../utils/metaTags';
import { getAvatarForHandle } from '../api/users';
import { getFollowedUsers } from '../api/posts';
import * as apiClient from '../api/client';
import Avatar from './Avatar';
import type { Post } from '../types';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    post: Post;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, post }) => {
    const [copied, setCopied] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [followedHandles, setFollowedHandles] = useState<string[]>([]);
    const [loadingFollowed, setLoadingFollowed] = useState(false);
    const navigate = useNavigate();
    const { user } = useAuth();

    const postUrl = `${window.location.origin}/post/${post.id}`;
    const postTitle = post.text ? post.text.substring(0, 100) + (post.text.length > 100 ? '...' : '') : 'Check out this post';
    const shareText = `${postTitle} by ${post.userHandle}`;

    // Fetch people you follow when modal opens (for "Share to DM" list)
    useEffect(() => {
        if (!isOpen || !user) return;
        setLoadingFollowed(true);
        const useLaravel = import.meta.env.VITE_USE_LARAVEL_API !== 'false';

        const setFromLocal = () => {
            getFollowedUsers(user.id)
                .then(setFollowedHandles)
                .catch(() => setFollowedHandles([]))
                .finally(() => setLoadingFollowed(false));
        };

        const hasToken = typeof localStorage !== 'undefined' && !!localStorage.getItem('authToken');
        if (useLaravel && user.handle && hasToken) {
            apiClient
                .fetchFollowing(user.handle, 0, 100)
                .then((res: { items?: { handle?: string; user_handle?: string }[] }) => {
                    const apiHandles = (res?.items ?? []).map((u) => u.handle ?? u.user_handle).filter(Boolean) as string[];
                    return getFollowedUsers(user.id).then((localHandles) => {
                        const merged = [...new Set([...apiHandles, ...localHandles])];
                        setFollowedHandles(merged.length ? merged : apiHandles);
                    });
                })
                .catch((err) => {
                    console.warn('Share modal: fetchFollowing failed, using local list', err);
                    setFromLocal();
                    return;
                })
                .finally(() => setLoadingFollowed(false));
        } else {
            setFromLocal();
        }
    }, [isOpen, user?.id, user?.handle]);

    // Update meta tags when modal opens for Twitter Card sharing
    useEffect(() => {
        if (isOpen) {
            const avatarUrl = getAvatarForHandle(post.userHandle);
            const imageUrl = post.mediaUrl || avatarUrl || undefined;

            updateMetaTags({
                title: `${postTitle} by ${post.userHandle}`,
                description: post.text ? post.text.substring(0, 200) : `Check out this post by ${post.userHandle}`,
                image: imageUrl,
                url: postUrl,
                type: 'article'
            });

            return () => {
                clearMetaTags();
            };
        }
    }, [isOpen, post.id, postTitle, post.text, post.userHandle, post.mediaUrl, postUrl]);

    if (!isOpen) return null;

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(postUrl);
            setCopied(true);
            showToast?.('Link copied!');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };

    async function generateImageFromText(text: string): Promise<string> {
        const width = 1080;
        const height = 1920;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#0ea5e9');
        grad.addColorStop(0.5, '#8b5cf6');
        grad.addColorStop(1, '#f43f5e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const margin = 96;
        const maxWidth = width - margin * 2;
        let fontSize = 64;
        ctx.font = `${fontSize}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
        function wrapLines(t: string): string[] {
            const words = t.split(/\s+/);
            const lines: string[] = [];
            let line = '';
            for (const w of words) {
                const test = line ? line + ' ' + w : w;
                if (ctx.measureText(test).width > maxWidth) {
                    if (line) lines.push(line);
                    line = w;
                } else {
                    line = test;
                }
            }
            if (line) lines.push(line);
            return lines;
        }
        const safeText = (text || 'Shared from the feed').slice(0, 240);
        let lines = wrapLines(safeText);
        while (lines.length > 10 && fontSize > 36) {
            fontSize -= 6;
            ctx.font = `${fontSize}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
            lines = wrapLines(safeText);
        }
        const lineHeight = fontSize * 1.35;
        const totalHeight = lines.length * lineHeight;
        let y = height / 2 - totalHeight / 2;
        for (const ln of lines) {
            ctx.fillText(ln, width / 2, y);
            y += lineHeight;
        }
        return canvas.toDataURL('image/png');
    }

    const handleShareToStory = async () => {
        if (!user) {
            alert('Please sign in to share clips.');
            return;
        }
        const maxLength = 200;
        const truncatedText = post.text && post.text.length > maxLength
            ? post.text.substring(0, maxLength) + '...'
            : post.text;

        try {
            let mediaUrl = post.mediaUrl;
            let mediaType: 'image' | 'video' = (post.mediaType || 'image');
            if (!mediaUrl) {
                mediaUrl = await generateImageFromText(truncatedText || '');
                mediaType = 'image';
            }
            await createStory(
                user.id,
                user.handle || '',
                mediaUrl,
                mediaType,
                truncatedText,
                post.locationLabel,
                undefined,
                undefined,
                post.id,
                post.userHandle
            );
            onClose();
            showToast?.('You shared this to Clips 24!');
            navigate('/stories', { state: { openUserHandle: user.handle } });
        } catch (e) {
            console.error('Failed to share to clips:', e);
            alert('Failed to share to Clips 24. Please try again.');
        }
    };

    const handleShare = (platform: string) => {
        const encodedUrl = encodeURIComponent(postUrl);
        const encodedText = encodeURIComponent(shareText);
        let shareUrl = '';
        switch (platform) {
            case 'whatsapp':
                shareUrl = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
                break;
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
                break;
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
                break;
            case 'gmail':
                shareUrl = `mailto:?subject=${encodedText}&body=${encodedText}%0A%0A${encodedUrl}`;
                break;
        case 'linkedin':
            shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
            break;
        case 'sms':
            shareUrl = `sms:?body=${encodedText}%20${encodedUrl}`;
            window.location.href = shareUrl;
            return;
        case 'threads':
            shareUrl = `https://www.threads.net/intent/post?text=${encodedText}%20${encodedUrl}`;
            break;
        default:
            return;
    }
    window.open(shareUrl, '_blank', 'width=600,height=400');
};

    const handleShareToDM = (handle: string) => {
        onClose();
        navigate(`/messages/${encodeURIComponent(handle)}`, {
            state: { sharePostUrl: postUrl, sharePostId: post.id }
        });
        showToast?.('Post link ready to send!');
    };

    const q = searchQuery.trim().toLowerCase();
    const filteredHandles = q
        ? followedHandles.filter(h => h.toLowerCase().includes(q))
        : followedHandles;

    // Horizontal scrollable share options – Simple Icons for recognisable brand logos
    const iconWrap = (children: React.ReactNode, bg: string, className = '') => (
        <div className={`w-12 h-12 min-w-[48px] min-h-[48px] rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${bg} ${className}`}>
            {children}
        </div>
    );
    const shareOptions = [
        {
            id: 'whatsapp',
            label: 'WhatsApp',
            icon: iconWrap(<SiWhatsapp className="w-6 h-6 text-white" aria-hidden />, 'bg-[#25D366]'),
            action: () => handleShare('whatsapp')
        },
        {
            id: 'x',
            label: 'X',
            icon: iconWrap(<SiX className="w-5 h-5 text-white" aria-hidden />, 'bg-black'),
            action: () => handleShare('twitter')
        },
        {
            id: 'facebook',
            label: 'Facebook',
            icon: iconWrap(<SiFacebook className="w-6 h-6 text-white" aria-hidden />, 'bg-[#1877F2]'),
            action: () => handleShare('facebook')
        },
        {
            id: 'instagram',
            label: 'Instagram',
            icon: iconWrap(<SiInstagram className="w-6 h-6 text-white" aria-hidden />, 'bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737]'),
            action: async () => {
                await handleCopyLink();
                showToast?.('Link copied – paste in Instagram');
            }
        },
        {
            id: 'threads',
            label: 'Threads',
            icon: iconWrap(<SiThreads className="w-5 h-5 text-white" aria-hidden />, 'bg-black'),
            action: () => handleShare('threads')
        },
        {
            id: 'sms',
            label: 'SMS',
            icon: iconWrap(<FiMessageCircle className="w-6 h-6 text-white" aria-hidden />, 'bg-gray-600'),
            action: () => handleShare('sms')
        },
        {
            id: 'story',
            label: 'Add to story',
            icon: iconWrap(<span className="text-gray-300 text-xl font-light leading-none">+</span>, 'bg-gray-800/80', 'border-2 border-dashed border-gray-500'),
            action: handleShareToStory
        },
        {
            id: 'copy',
            label: 'Copy link',
            icon: iconWrap(<FiLink className="w-5 h-5 text-white" aria-hidden />, 'bg-gray-600'),
            action: handleCopyLink
        }
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-[200]" onClick={onClose}>
            <div
                className="bg-gray-900 w-full max-w-md rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-gray-600" />
                </div>

                {/* Search bar */}
                <div className="px-4 pb-3">
                    <div className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2.5">
                        <FiSearch className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <input
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none min-w-0"
                        />
                    </div>
                </div>

                {/* List of people you follow */}
                <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
                    {loadingFollowed ? (
                        <div className="py-8 text-center text-gray-400 text-sm">Loading...</div>
                    ) : filteredHandles.length === 0 ? (
                        <div className="py-8 text-center text-gray-400 text-sm">
                            {q ? 'No matches' : 'No people you follow yet'}
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-4 sm:gap-6">
                            {filteredHandles.map(handle => (
                                <button
                                    key={handle}
                                    type="button"
                                    onClick={() => handleShareToDM(handle)}
                                    className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-gray-800/80 active:bg-gray-800 transition-colors"
                                >
                                    <Avatar
                                        src={getAvatarForHandle(handle)}
                                        name={handle.split('@')[0]}
                                        size="lg"
                                    />
                                    <span className="text-xs text-white text-center truncate w-full" title={handle}>
                                        {handle.split('@')[0]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Share to – social logos row (always visible at bottom) */}
                <div className="border-t border-gray-800 flex-shrink-0 bg-gray-900/95">
                    <p className="px-4 pt-3 pb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Share to</p>
                    <div className="px-2 pb-4 overflow-x-auto overflow-y-hidden scrollbar-hide">
                        <div className="flex items-center gap-5 sm:gap-6 min-w-max px-2">
                            {shareOptions.map(({ id, label, icon, action }) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => {
                                        action();
                                        if (id === 'copy') return;
                                        onClose();
                                    }}
                                    className="flex flex-col items-center gap-2 flex-shrink-0 min-w-[56px] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg"
                                >
                                    {icon}
                                    <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">
                                        {id === 'copy' && copied ? 'Copied!' : label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;

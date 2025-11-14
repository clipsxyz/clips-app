import React, { useState, useEffect } from 'react';
import { FiX, FiCopy, FiShare2, FiLink, FiMessageCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { createStory } from '../api/stories';
import { showToast } from '../utils/toast';
import { updateMetaTags, clearMetaTags } from '../utils/metaTags';
import { getAvatarForHandle } from '../api/users';
import { appendMessage } from '../api/messages';
import type { Post } from '../types';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    post: Post;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, post }) => {
    const [copied, setCopied] = useState(false);
    const navigate = useNavigate();
    const { user } = useAuth();

    const postUrl = `${window.location.origin}/post/${post.id}`;
    const postTitle = post.text ? post.text.substring(0, 100) + (post.text.length > 100 ? '...' : '') : 'Check out this post';
    const shareText = `${postTitle} by ${post.userHandle}`;

    // Update meta tags when modal opens for Twitter Card sharing
    useEffect(() => {
        if (isOpen) {
            const avatarUrl = getAvatarForHandle(post.userHandle);
            const imageUrl = post.mediaUrl || avatarUrl || undefined;
            
            updateMetaTags({
                title: `${postTitle} by ${post.userHandle}`,
                description: post.text ? post.text.substring(0, 200) : `Check out this post by ${post.userHandle}`,
                image: imageUrl, // Use post media or profile picture
                url: postUrl,
                type: 'article'
            });

            // Cleanup: restore default meta tags when modal closes
            return () => {
                clearMetaTags();
            };
        }
    }, [isOpen, post.id, postTitle, post.text, post.userHandle, post.mediaUrl, postUrl]);

    if (!isOpen) return null;

    console.log('ShareModal rendered with post:', post);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(postUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };

    // Generate an image for text-only posts so they can be shared to stories
    async function generateImageFromText(text: string): Promise<string> {
        const width = 1080;
        const height = 1920;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;

        // Background gradient
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#0ea5e9');
        grad.addColorStop(0.5, '#8b5cf6');
        grad.addColorStop(1, '#f43f5e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Text styles
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const margin = 96;
        const maxWidth = width - margin * 2;
        let fontSize = 64;
        ctx.font = `${fontSize}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial`;

        // Wrap text into lines
        function wrapLines(t: string): string[] {
            const words = t.split(/\s+/);
            const lines: string[] = [];
            let line = '';
            for (const w of words) {
                const test = line ? line + ' ' + w : w;
                const metrics = ctx.measureText(test);
                if (metrics.width > maxWidth) {
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
        // If too many lines, reduce font size
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
        console.log('Share to story clicked', post);
        if (!user) { alert('Please sign in to share clips.'); return; }

        // Truncate text to 200 characters for stories
        const maxLength = 200;
        const truncatedText = post.text && post.text.length > maxLength
            ? post.text.substring(0, maxLength) + '...'
            : post.text;

        try {
            let mediaUrl = post.mediaUrl;
            let mediaType: 'image' | 'video' = (post.mediaType || 'image');

            // If no media on post, render a text image
            if (!mediaUrl) {
                mediaUrl = await generateImageFromText(truncatedText || '');
                mediaType = 'image';
            }

            // Create the story directly
            await createStory(
                user.id,
                user.handle || '',
                mediaUrl,
                mediaType,
                truncatedText,
                post.locationLabel,
                undefined, // textColor
                undefined, // textSize
                post.id, // sharedFromPost
                post.userHandle // sharedFromUser
            );

            // Close the share modal
            onClose();

            // Show success toast
            showToast?.('You shared this to Clips 24!');

            // Navigate to Clips 24 page (StoriesPage)
            navigate('/stories', {
                state: {
                    openUserHandle: user.handle // Open current user's clips
                }
            });
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
            default:
                return;
        }

        window.open(shareUrl, '_blank', 'width=600,height=400');
    };

    // Only include "Share to Story" if post has media
    const baseShareOptions = [
        {
            id: 'copy',
            name: 'Copy Link',
            icon: <FiCopy className="w-6 h-6" />,
            color: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
            action: handleCopyLink
        },
        {
            id: 'whatsapp',
            name: 'WhatsApp',
            icon: (
                <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">W</span>
                </div>
            ),
            color: 'bg-green-50 hover:bg-green-100 text-green-800',
            action: () => handleShare('whatsapp')
        },
        {
            id: 'facebook',
            name: 'Facebook',
            icon: (
                <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">f</span>
                </div>
            ),
            color: 'bg-blue-50 hover:bg-blue-100 text-blue-800',
            action: () => handleShare('facebook')
        },
        {
            id: 'twitter',
            name: 'X (Twitter)',
            icon: (
                <div className="w-6 h-6 bg-black rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">X</span>
                </div>
            ),
            color: 'bg-gray-50 hover:bg-gray-100 text-gray-800',
            action: () => handleShare('twitter')
        },
        {
            id: 'gmail',
            name: 'Gmail',
            icon: (
                <div className="w-6 h-6 bg-red-500 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">G</span>
                </div>
            ),
            color: 'bg-red-50 hover:bg-red-100 text-red-800',
            action: () => handleShare('gmail')
        },
        {
            id: 'linkedin',
            name: 'LinkedIn',
            icon: (
                <div className="w-6 h-6 bg-blue-700 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">in</span>
                </div>
            ),
            color: 'bg-blue-50 hover:bg-blue-100 text-blue-800',
            action: () => handleShare('linkedin')
        }
    ];

    const handleShareToDM = async () => {
        if (!user?.handle) {
            alert('Please sign in to share to DMs.');
            return;
        }
        
        // Close the share modal
        onClose();
        
        // Navigate to inbox with post URL in state
        // User can select a conversation, and the post link will be auto-filled
        navigate('/inbox', { 
            state: { 
                sharePostUrl: postUrl,
                sharePostId: post.id
            } 
        });
        
        // Also copy the link to clipboard for convenience
        try {
            await navigator.clipboard.writeText(postUrl);
            showToast?.('Post link ready! Select a conversation to share.');
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };

    // Always include Share to Clip option (works for media and text-only)
    const shareOptions = [
        {
            id: 'story',
            name: 'Share to Clip',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            color: 'bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white',
            action: handleShareToStory
        },
        {
            id: 'dm',
            name: 'Share to DM',
            icon: <FiMessageCircle className="w-6 h-6" />,
            color: 'bg-gradient-to-br from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white',
            action: handleShareToDM
        },
        ...baseShareOptions
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-[200]">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-3xl shadow-2xl transform transition-transform duration-300 ease-out">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <FiShare2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Share Post</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Share this post with others</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <FiX className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                </div>

                {/* Share Options */}
                <div className="p-6">
                    <div className="grid grid-cols-2 gap-4 auto-rows-fr">
                        {shareOptions.map((option) => (
                            <button
                                key={option.id}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    option.action();
                                }}
                                className={`flex items-center gap-3 p-4 rounded-xl transition-all duration-200 hover:scale-105 ${option.color}`}
                            >
                                {option.icon}
                                <span className="font-medium">{option.name}</span>
                                {option.id === 'copy' && copied && (
                                    <span className="text-xs text-green-600 ml-auto">Copied!</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Post Preview */}
                    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                {post.userHandle.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-gray-900 dark:text-white text-sm">
                                        {post.userHandle}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {post.locationLabel}
                                    </span>
                                </div>
                                {post.text && (
                                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                                        {post.text}
                                    </p>
                                )}
                                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    <FiLink className="w-3 h-3 inline mr-1" />
                                    {postUrl}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;

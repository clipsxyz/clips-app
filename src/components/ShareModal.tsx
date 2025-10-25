import React, { useState } from 'react';
import { FiX, FiCopy, FiShare2, FiLink } from 'react-icons/fi';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    post: {
        id: string;
        userHandle: string;
        text?: string;
        mediaUrl?: string;
        locationLabel: string;
    };
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, post }) => {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const postUrl = `${window.location.origin}/post/${post.id}`;
    const postTitle = post.text ? post.text.substring(0, 100) + (post.text.length > 100 ? '...' : '') : 'Check out this post';
    const shareText = `${postTitle} by ${post.userHandle}`;

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(postUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
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

    const shareOptions = [
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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
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
                    <div className="grid grid-cols-2 gap-4">
                        {shareOptions.map((option) => (
                            <button
                                key={option.id}
                                onClick={option.action}
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

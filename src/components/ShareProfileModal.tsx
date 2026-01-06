import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiX, FiCopy, FiShare2 } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import { createStory } from '../api/stories';
import { showToast } from '../utils/toast';

interface ShareProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    handle: string;
    name: string;
    avatarUrl?: string;
}

const ShareProfileModal: React.FC<ShareProfileModalProps> = ({ isOpen, onClose, handle, name, avatarUrl }) => {
    const [copied, setCopied] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const navigate = useNavigate();
    const { user } = useAuth();

    if (!isOpen) return null;

    const profileUrl = `${window.location.origin}/user/${encodeURIComponent(handle)}`;
    const shareText = `Check out ${name}'s profile on Gazetteer`;

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(profileUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };

    const handleShare = (platform: string) => {
        const encodedUrl = encodeURIComponent(profileUrl);
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

    const handleShareToStory = async () => {
        if (!user) {
            alert('Please sign in to share to stories.');
            return;
        }

        setIsSharing(true);

        try {
            // Create an image from the profile for the story
            let mediaUrl = avatarUrl;
            let mediaType: 'image' | 'video' = 'image';

            // If no avatar, create a text-based image
            if (!mediaUrl) {
                mediaUrl = await generateProfileImage(name, handle);
            }

            // Create the story with profile information
            // Tag the profile user so their name can be clickable
            await createStory(
                user.id,
                user.handle || '',
                mediaUrl,
                mediaType,
                `Check out @${handle}'s profile!`,
                undefined, // location
                undefined, // textColor
                undefined, // textSize
                undefined, // sharedFromPost
                handle, // sharedFromUser (the profile being shared)
                undefined, // textStyle
                undefined, // stickers
                [handle] // taggedUsers - tag the profile so name can be clickable
            );

            // Close the modal
            onClose();

            // Show success toast
            showToast?.('Profile shared to stories!');

            // Navigate to stories page
            navigate('/stories', {
                state: {
                    openUserHandle: user.handle // Open current user's stories
                }
            });
        } catch (e) {
            console.error('Failed to share profile to stories:', e);
            alert('Failed to share profile to stories. Please try again.');
        } finally {
            setIsSharing(false);
        }
    };

    // Generate a profile image for stories if no avatar
    async function generateProfileImage(profileName: string, profileHandle: string): Promise<string> {
        const width = 1080;
        const height = 1920;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Could not get canvas context');
        }

        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#ec4899');
        gradient.addColorStop(0.5, '#a855f7');
        gradient.addColorStop(1, '#7c3aed');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Text styling
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Profile name
        ctx.font = 'bold 72px Arial';
        const nameY = height / 2 - 100;
        ctx.fillText(profileName.toUpperCase(), width / 2, nameY);

        // Handle
        ctx.font = '48px Arial';
        ctx.fillText(`@${profileHandle}`, width / 2, nameY + 100);

        // "View Profile" text
        ctx.font = '36px Arial';
        ctx.fillText('View Profile on Gazetteer', width / 2, nameY + 200);

        return canvas.toDataURL('image/png');
    }

    const shareOptions = [
        {
            id: 'story',
            name: 'Share to Stories',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            ),
            color: 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white',
            action: handleShareToStory,
            isLoading: isSharing
        },
        {
            id: 'copy',
            name: 'Copy Link',
            icon: <FiCopy className="w-6 h-6" />,
            color: copied ? 'bg-green-100 text-green-800' : 'bg-gray-100 hover:bg-gray-200 text-gray-800',
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Share Profile</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Close"
                    >
                        <FiX className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* Share Options Grid */}
                <div className="p-6">
                    <div className="grid grid-cols-4 gap-4">
                        {shareOptions.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => {
                                    if (option.action) {
                                        option.action();
                                    }
                                }}
                                disabled={option.isLoading}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${option.color} ${
                                    option.isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
                                }`}
                            >
                                {option.isLoading ? (
                                    <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    option.icon
                                )}
                                <span className="text-xs font-medium text-center">{option.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareProfileModal;


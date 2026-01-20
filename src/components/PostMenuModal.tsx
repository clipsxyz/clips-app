import React from 'react';
import { Post } from '../types';
import {
    FiX,
    FiBookmark,
    FiCopy,
    FiShare2,
    FiFlag,
    FiUserMinus,
    FiVolumeX,
    FiUserX,
    FiEyeOff,
    FiStar,
    FiRefreshCw,
    FiMaximize,
    FiTrash2,
    FiEdit3,
    FiArchive,
    FiBell,
    FiBellOff,
    FiInfo,
    FiZap,
    FiRepeat
} from 'react-icons/fi';
import SavePostModal from './SavePostModal';
import QRCodeModal from './QRCodeModal';

interface PostMenuModalProps {
    post: Post;
    userId: string;
    isOpen: boolean;
    onClose: () => void;
    onCopyLink?: () => void;
    onShare?: () => void;
    onReport?: () => void;
    onUnfollow?: () => Promise<void>;
    onMute?: () => Promise<void>;
    onBlock?: () => Promise<void>;
    onHide?: () => void;
    onNotInterested?: () => void;
    onDelete?: () => Promise<void>;
    onEdit?: () => void;
    onArchive?: () => Promise<void>;
    onBoost?: () => void;
    onReclip?: () => Promise<void>;
    onTurnOnNotifications?: () => void;
    onTurnOffNotifications?: () => void;
    isCurrentUser?: boolean;
    isFollowing?: boolean;
    isSaved?: boolean;
    isMuted?: boolean;
    isBlocked?: boolean;
    hasNotifications?: boolean;
}

export default function PostMenuModal({
    post,
    userId,
    isOpen,
    onClose,
    onCopyLink,
    onShare,
    onReport,
    onUnfollow,
    onMute,
    onBlock,
    onHide,
    onNotInterested,
    onDelete,
    onEdit,
    onArchive,
    onBoost,
    onReclip,
    onTurnOnNotifications,
    onTurnOffNotifications,
    isCurrentUser = false,
    isFollowing = false,
    isSaved = false,
    isMuted = false,
    isBlocked: _isBlocked = false, // Reserved for future use
    hasNotifications = false,
}: PostMenuModalProps) {
    const [showSaveModal, setShowSaveModal] = React.useState(false);
    const [showQRCodeModal, setShowQRCodeModal] = React.useState(false);
    const [isProcessing, setIsProcessing] = React.useState(false);

    if (!isOpen) return null;

    const handleSave = () => {
        setShowSaveModal(true);
    };

    const handleCopyLink = async () => {
        try {
            const url = `${window.location.origin}/post/${post.id}`;
            await navigator.clipboard.writeText(url);
            // Show toast or feedback
            onClose();
            onCopyLink?.();
        } catch (error) {
            console.error('Failed to copy link:', error);
        }
    };

    const handleAction = async (action: () => void | Promise<void>) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            await action();
            onClose();
        } catch (error) {
            console.error('Error performing action:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    // Menu items based on whether it's current user's post or not
    type MenuItem = {
        icon: React.ComponentType<{ className?: string }>;
        label: string;
        action?: () => void | Promise<void>;
        danger?: boolean;
        highlight?: boolean;
    };

    const menuItems: MenuItem[] = isCurrentUser
        ? [
            // Own posts (removed Share and Boost - already in top row)
            { icon: FiTrash2, label: 'Delete', action: onDelete, danger: true },
            { icon: FiEdit3, label: 'Edit', action: onEdit },
            { icon: FiCopy, label: 'Copy Link', action: handleCopyLink },
            { icon: FiArchive, label: 'Archive', action: onArchive },
            { icon: hasNotifications ? FiBellOff : FiBell, label: hasNotifications ? 'Turn off post notifications' : 'Turn on post notifications', action: hasNotifications ? onTurnOffNotifications : onTurnOnNotifications },
        ]
        : [
            // Other users' posts (removed Save, Share, QR code - already in top row)
            { icon: FiRepeat, label: 'Reclip', action: onReclip },
            { icon: FiCopy, label: 'Copy Link', action: handleCopyLink },
            { icon: FiFlag, label: 'Report post', action: onReport, danger: true },
            ...(isFollowing ? [{ icon: FiUserMinus, label: `Unfollow ${post.userHandle.split('@')[0]}`, action: onUnfollow }] : []),
            { icon: FiVolumeX, label: isMuted ? `Unmute ${post.userHandle.split('@')[0]}` : `Mute ${post.userHandle.split('@')[0]}`, action: onMute },
            { icon: FiUserX, label: `Block ${post.userHandle.split('@')[0]}`, action: onBlock, danger: true },
            { icon: FiEyeOff, label: 'Hide', action: onHide },
            { icon: FiInfo, label: 'Not interested', action: onNotInterested },
        ];

    return (
        <>
            <div className="fixed inset-0 z-[200] flex items-end">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Modal Sheet */}
                <div className="relative w-full bg-[#262626] dark:bg-[#1a1a1a] rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
                    {/* Close button at top */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-700/50 transition-colors"
                        aria-label="Close"
                    >
                        <FiX className="w-5 h-5 text-white" />
                    </button>
                    {/* Drag Handle */}
                    <div className="flex justify-center pt-3 pb-2">
                        <div className="w-12 h-1 bg-gray-500 dark:bg-gray-600 rounded-full" />
                    </div>

                    {/* Top Action Buttons Row */}
                    <div className="px-4 py-3 border-b border-gray-700 dark:border-gray-800 flex items-center justify-around">
                        {/* Save/Bookmark */}
                        <button
                            onClick={handleSave}
                            disabled={isProcessing}
                            className="flex flex-col items-center gap-2 py-2 px-4 rounded-lg hover:bg-gray-700/50 dark:hover:bg-gray-600/50 transition-colors disabled:opacity-50"
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSaved ? 'bg-yellow-500/20' : 'bg-gray-700 dark:bg-gray-600'}`}>
                                <FiBookmark className={`w-6 h-6 ${isSaved ? 'text-yellow-400 fill-yellow-400' : 'text-white'}`} />
                            </div>
                            <span className="text-xs text-white font-medium">{isSaved ? 'Saved' : 'Save'}</span>
                        </button>

                        {/* Share */}
                        <button
                            onClick={() => onShare && handleAction(onShare)}
                            disabled={isProcessing}
                            className="flex flex-col items-center gap-2 py-2 px-4 rounded-lg hover:bg-gray-700/50 dark:hover:bg-gray-600/50 transition-colors disabled:opacity-50"
                        >
                            <div className="w-12 h-12 rounded-full bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
                                <FiShare2 className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-xs text-white font-medium">Share</span>
                        </button>

                        {/* Boost - only for own posts */}
                        {isCurrentUser && onBoost && (
                            <button
                                onClick={() => onBoost && handleAction(onBoost)}
                                disabled={isProcessing}
                                className="flex flex-col items-center gap-2 py-2 px-4 rounded-lg hover:bg-gray-700/50 dark:hover:bg-gray-600/50 transition-colors disabled:opacity-50"
                            >
                                <div className="w-12 h-12 rounded-full bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
                                    <FiZap className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-xs text-white font-medium">Boost</span>
                            </button>
                        )}

                        {/* QR Code - only for other users' posts */}
                        {!isCurrentUser && (
                            <button
                                onClick={() => {
                                    setShowQRCodeModal(true);
                                }}
                                disabled={isProcessing}
                                className="flex flex-col items-center gap-2 py-2 px-4 rounded-lg hover:bg-gray-700/50 dark:hover:bg-gray-600/50 transition-colors disabled:opacity-50"
                            >
                                <div className="w-12 h-12 rounded-full bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
                                    <FiMaximize className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-xs text-white font-medium">QR code</span>
                            </button>
                        )}
                    </div>

                    {/* Menu Items Grid */}
                    <div className="flex-1 overflow-y-auto py-4 px-4">
                        <div className="grid grid-cols-3 gap-4">
                            {menuItems.map((item, index) => {
                                const Icon = item.icon;
                                const isDanger = item.danger;
                                const isHighlight = item.highlight;

                                return (
                                    <button
                                        key={index}
                                        onClick={() => item.action && handleAction(item.action)}
                                        disabled={isProcessing}
                                        className="flex flex-col items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-700/50 dark:hover:bg-gray-600/50 transition-colors disabled:opacity-50"
                                    >
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                            isDanger 
                                                ? 'bg-red-500/20' 
                                                : isHighlight 
                                                    ? 'bg-yellow-500/20' 
                                                    : 'bg-gray-700 dark:bg-gray-600'
                                        }`}>
                                            <Icon className={`w-6 h-6 ${
                                                isDanger 
                                                    ? 'text-red-400' 
                                                    : isHighlight 
                                                        ? 'text-yellow-400' 
                                                        : 'text-white'
                                            }`} />
                                        </div>
                                        <span className={`text-xs font-medium text-center leading-tight ${
                                            isDanger 
                                                ? 'text-red-400' 
                                                : isHighlight 
                                                    ? 'text-yellow-400' 
                                                    : 'text-white'
                                        }`}>
                                            {item.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </div>

            {/* Save Post Modal */}
            {showSaveModal && (
                <SavePostModal
                    post={post}
                    userId={userId}
                    isOpen={showSaveModal}
                    onClose={() => {
                        setShowSaveModal(false);
                        onClose();
                    }}
                    onSaved={() => {
                        setShowSaveModal(false);
                        onClose();
                    }}
                />
            )}

            {/* QR Code Modal */}
            {showQRCodeModal && (
                <QRCodeModal
                    post={post}
                    isOpen={showQRCodeModal}
                    onClose={() => {
                        setShowQRCodeModal(false);
                        onClose();
                    }}
                />
            )}
        </>
    );
}


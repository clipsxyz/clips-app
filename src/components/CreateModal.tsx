import React from 'react';
import { FiX, FiCamera, FiImage } from 'react-icons/fi';
import Avatar from './Avatar';
import { useAuth } from '../context/Auth';

interface CreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (path: string) => void;
}

export default function CreateModal({ isOpen, onClose, onNavigate }: CreateModalProps) {
    const { user } = useAuth();

    if (!isOpen) return null;

    const handleNavigate = (path: string) => {
        onNavigate(path);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full bg-white dark:bg-gray-950 rounded-t-3xl animate-in slide-in-from-bottom duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 pt-4 pb-2">
                    <div className="h-1 w-12 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4"></div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create</h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <FiX className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Options */}
                <div className="px-4 pb-6 space-y-3">
                    {/* Instant Create Option */}
                    <button
                        onClick={() => handleNavigate('/create/instant')}
                        className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-red-500 via-pink-500 to-purple-600 p-0.5">
                            <div className="w-full h-full rounded-full bg-gray-950 flex items-center justify-center">
                                <FiCamera className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">Instant Create</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                Open camera immediately and record a clip, then add filters
                            </div>
                        </div>
                    </button>
                    {/* Create Story Option */}
                    <button
                        onClick={() => handleNavigate('/clip')}
                        className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-green-500 via-blue-500 to-blue-600 p-0.5">
                            <div className="w-full h-full rounded-full bg-gray-950 flex items-center justify-center">
                                <FiCamera className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">Create Clip</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                Share a photo or video that disappears after 24 hours
                            </div>
                        </div>
                    </button>

                    {/* Create Post Option */}
                    <button
                        onClick={() => handleNavigate('/create')}
                        className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                            <FiImage className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">Create Post</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                Share to your newsfeed with text, photos, or videos
                            </div>
                        </div>
                    </button>

                    {/* Recent Activity */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                        <div className="flex items-center gap-3 px-2 py-2">
                            <Avatar
                                src={user?.avatarUrl}
                                name={user?.name || 'User'}
                                size="sm"
                            />
                            <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {user?.name || 'User'}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                    @{user?.handle || 'user'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}



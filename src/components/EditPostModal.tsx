import React, { useState, useEffect } from 'react';
import { FiX, FiMapPin } from 'react-icons/fi';
import { Post } from '../types';

interface EditPostModalProps {
    post: Post;
    isOpen: boolean;
    onClose: () => void;
    onSave: (text: string, location: string) => Promise<void>;
}

export default function EditPostModal({
    post,
    isOpen,
    onClose,
    onSave
}: EditPostModalProps) {
    const [text, setText] = useState('');
    const [location, setLocation] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setText(post.text || post.text_content || '');
            setLocation(post.locationLabel || '');
            setError(null);
        }
    }, [isOpen, post]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (isSaving) return;

        setError(null);
        setIsSaving(true);

        try {
            await onSave(text.trim(), location.trim());
            onClose();
        } catch (err: any) {
            // Check if it's a connection error (backend not running)
            const isConnectionError =
                err?.message === 'CONNECTION_REFUSED' ||
                err?.name === 'ConnectionRefused' ||
                err?.message?.includes('Failed to fetch') ||
                err?.message?.includes('ERR_CONNECTION_REFUSED') ||
                err?.message?.includes('NetworkError');

            if (isConnectionError) {
                setError('Backend server is not running. Please start the Laravel backend server (php artisan serve) and try again.');
            } else {
                setError(err.message || 'Failed to update post');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        if (!isSaving) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md mx-4 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Edit Post
                    </h2>
                    <button
                        onClick={handleClose}
                        disabled={isSaving}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-50"
                    >
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Text Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Text
                        </label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="What's on your mind?"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 dark:focus:ring-pink-400 resize-none"
                            rows={4}
                            maxLength={500}
                            disabled={isSaving}
                        />
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                            {text.length}/500
                        </div>
                    </div>

                    {/* Location Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Location
                        </label>
                        <div className="relative">
                            <FiMapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Add location"
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 dark:focus:ring-pink-400"
                                maxLength={200}
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={handleClose}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}


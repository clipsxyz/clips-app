import React, { useState, useEffect } from 'react';
import { FiX, FiUser } from 'react-icons/fi';
import { unifiedSearch } from '../api/search';
import Avatar from './Avatar';

interface TaggedUsersBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    taggedUserHandles: string[]; // Array of user handles
}

interface TaggedUser {
    handle: string;
    display_name?: string;
    avatar_url?: string;
}

export default function TaggedUsersBottomSheet({ isOpen, onClose, taggedUserHandles }: TaggedUsersBottomSheetProps) {
    const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && taggedUserHandles.length > 0) {
            fetchTaggedUsers();
        } else {
            setTaggedUsers([]);
        }
    }, [isOpen, taggedUserHandles]);

    const fetchTaggedUsers = async () => {
        setIsLoading(true);
        try {
            // Fetch user information for each handle
            const userPromises = taggedUserHandles.map(async (handle) => {
                try {
                    const result = await unifiedSearch({
                        q: handle,
                        types: 'users',
                        usersLimit: 1
                    });
                    const user = result.sections?.users?.items?.find(u => u.handle.toLowerCase() === handle.toLowerCase());
                    if (user) {
                        return {
                            handle: user.handle,
                            display_name: user.display_name,
                            avatar_url: user.avatar_url
                        };
                    }
                    // If not found, return with just the handle
                    return {
                        handle: handle,
                        display_name: undefined,
                        avatar_url: undefined
                    };
                } catch (error) {
                    console.error(`Error fetching user ${handle}:`, error);
                    return {
                        handle: handle,
                        display_name: undefined,
                        avatar_url: undefined
                    };
                }
            });

            const users = await Promise.all(userPromises);
            setTaggedUsers(users);
        } catch (error) {
            console.error('Error fetching tagged users:', error);
            // Fallback: create user objects with just handles
            setTaggedUsers(taggedUserHandles.map(handle => ({ handle })));
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />
            
            {/* Bottom Sheet */}
            <div
                className={`fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${
                    isOpen ? 'translate-y-0' : 'translate-y-full'
                }`}
                style={{ maxHeight: '80vh' }}
            >
                {/* Handle Bar */}
                <div className="flex items-center justify-center pt-3 pb-2">
                    <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-800">
                            <FiUser className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                Tagged People
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {taggedUserHandles.length} {taggedUserHandles.length === 1 ? 'person' : 'people'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                        aria-label="Close"
                    >
                        <FiX className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto px-6 py-4" style={{ maxHeight: 'calc(80vh - 120px)' }}>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : taggedUsers.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <p>No tagged users found</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {taggedUsers.map((user) => (
                                <div
                                    key={user.handle}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <Avatar
                                        src={user.avatar_url}
                                        name={user.display_name || user.handle}
                                        size="md"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-gray-900 dark:text-gray-100 font-semibold truncate">
                                            {user.display_name || user.handle}
                                        </p>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm truncate">
                                            @{user.handle}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}


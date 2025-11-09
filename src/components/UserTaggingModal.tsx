import React, { useState, useEffect } from 'react';
import { FiX, FiSearch, FiUser } from 'react-icons/fi';
import { unifiedSearch, type SearchSections } from '../api/search';
import Avatar from './Avatar';

interface UserTaggingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectUser: (handle: string, name: string) => void;
    taggedUsers: string[]; // Array of handles already tagged
}

export default function UserTaggingModal({ isOpen, onClose, onSelectUser, taggedUsers }: UserTaggingModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<Array<{ handle: string; display_name?: string; avatar_url?: string }>>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setUsers([]);
        }
    }, [isOpen]);

    useEffect(() => {
        const searchUsers = async () => {
            if (!searchQuery.trim()) {
                setUsers([]);
                return;
            }

            setIsLoading(true);
            try {
                const result = await unifiedSearch({
                    q: searchQuery,
                    types: 'users',
                    usersLimit: 20
                });

                if (result.sections?.users?.items) {
                    setUsers(result.sections.users.items);
                } else {
                    setUsers([]);
                }
            } catch (error) {
                // Silently handle errors - unifiedSearch now returns empty results instead of throwing
                console.error('Error searching users:', error);
                setUsers([]);
            } finally {
                setIsLoading(false);
            }
        };

        const timeoutId = setTimeout(searchUsers, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
            <div className="w-full max-w-md max-h-[80vh] bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white">Tag People</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
                        aria-label="Close"
                    >
                        <FiX className="w-6 h-6" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-4 py-3 border-b border-gray-800">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by handle (e.g., Sarah@Artane)..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Users List */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            {searchQuery.trim() ? (
                                <p>No users found</p>
                            ) : (
                                <p>Search for users to tag</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {users.map((user) => {
                                const isTagged = taggedUsers.includes(user.handle);
                                return (
                                    <button
                                        key={user.handle}
                                        onClick={() => {
                                            if (!isTagged) {
                                                onSelectUser(user.handle, user.display_name || user.handle);
                                                onClose();
                                            }
                                        }}
                                        disabled={isTagged}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                                            isTagged
                                                ? 'bg-gray-800/50 cursor-not-allowed opacity-50'
                                                : 'bg-gray-800 hover:bg-gray-700 cursor-pointer'
                                        }`}
                                    >
                                        <Avatar
                                            src={user.avatar_url}
                                            name={user.display_name || user.handle}
                                            size="sm"
                                        />
                                        <div className="flex-1 text-left">
                                            <div className="text-white font-medium">{user.display_name || user.handle}</div>
                                            <div className="text-gray-400 text-sm">{user.handle}</div>
                                        </div>
                                        {isTagged && (
                                            <div className="text-xs text-brand-400 font-medium">Tagged</div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


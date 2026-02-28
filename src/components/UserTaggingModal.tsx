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

    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setUsers([]);
            // Focus input on mobile - use setTimeout to ensure modal is rendered
            setTimeout(() => {
                inputRef.current?.focus();
                // On mobile, we need to trigger the virtual keyboard
                if (inputRef.current) {
                    inputRef.current.click();
                }
            }, 100);
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
                // Normalize search query - remove @ if user types it
                const normalizedQuery = searchQuery.trim().replace(/^@/, '');
                
                const result = await unifiedSearch({
                    q: normalizedQuery,
                    types: 'users',
                    usersLimit: 20
                });

                if (result.sections?.users?.items) {
                    // Filter and sort results - prioritize exact matches
                    const queryLower = normalizedQuery.toLowerCase();
                    const filtered = result.sections.users.items.filter((user: any) => {
                        const handleLower = (user.handle || '').toLowerCase();
                        const nameLower = (user.display_name || user.handle || '').toLowerCase();
                        return handleLower.includes(queryLower) || nameLower.includes(queryLower);
                    });
                    
                    // Sort: exact handle match first, then handle starts with, then name match
                    const sorted = filtered.sort((a: any, b: any) => {
                        const aHandle = (a.handle || '').toLowerCase();
                        const bHandle = (b.handle || '').toLowerCase();
                        const aName = (a.display_name || a.handle || '').toLowerCase();
                        const bName = (b.display_name || b.handle || '').toLowerCase();
                        
                        // Exact handle match
                        if (aHandle === queryLower && bHandle !== queryLower) return -1;
                        if (bHandle === queryLower && aHandle !== queryLower) return 1;
                        
                        // Handle starts with query
                        if (aHandle.startsWith(queryLower) && !bHandle.startsWith(queryLower)) return -1;
                        if (bHandle.startsWith(queryLower) && !aHandle.startsWith(queryLower)) return 1;
                        
                        // Name starts with query
                        if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
                        if (bName.startsWith(queryLower) && !aName.startsWith(queryLower)) return 1;
                        
                        return 0;
                    });
                    
                    setUsers(sorted);
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

        // Reduced debounce for better mobile responsiveness
        const timeoutId = setTimeout(searchUsers, 200);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 p-4">
            <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
                <defs>
                    <linearGradient id="userTaggingModalIconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="w-full max-w-md max-h-[80vh] rounded-2xl p-[2px] flex flex-col overflow-hidden mx-4" style={{ background: 'linear-gradient(135deg, #3b82f6, #a855f7)' }}>
                <div className="bg-gray-900 rounded-[14px] flex flex-col overflow-hidden flex-1 min-h-0">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                        <FiUser className="w-6 h-6 shrink-0" style={{ stroke: 'url(#userTaggingModalIconGrad)', fill: 'none', strokeWidth: 2 }} />
                        <h2 className="text-xl font-bold text-white">Tag People</h2>
                    </div>
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
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by handle (e.g., sarah or sarah@artane)..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-base"
                            autoFocus
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                            inputMode="search"
                            enterKeyHint="search"
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
        </div>
    );
}


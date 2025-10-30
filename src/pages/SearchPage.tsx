import React from 'react';
import { FiSearch, FiMapPin, FiUsers, FiImage, FiPlayCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { fetchPostsByUser } from '../api/posts';
import { unifiedSearch, type SearchSections } from '../api/search';
import type { Post } from '../types';

export default function SearchPage() {
    const nav = useNavigate();
    const [searchQuery, setSearchQuery] = React.useState('');
    const [sections, setSections] = React.useState<SearchSections>({});
    const [placeholderIndex, setPlaceholderIndex] = React.useState(0);
    const [preloadPosts, setPreloadPosts] = React.useState<Post[] | null>(null);
    const [showSearchMode, setShowSearchMode] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<'locations' | 'users' | 'posts'>('locations');
    const [isFocused, setIsFocused] = React.useState(false);

    // Carousel placeholder between two messages
    React.useEffect(() => {
        const id = setInterval(() => {
            setPlaceholderIndex(i => (i + 1) % 2);
        }, 2500);
        return () => clearInterval(id);
    }, []);

    const placeholders = [
        'Search for stories by location',
        'Search for people on Gazetteer'
    ];

    // Debounced unified search
    React.useEffect(() => {
        const q = searchQuery.trim();
        const id = setTimeout(() => {
            if (!q) { setSections({}); return; }
            unifiedSearch({ q, types: 'users,locations,posts', usersLimit: 10, locationsLimit: 10, postsLimit: 12 })
                .then(r => setSections(r.sections))
                .catch(() => setSections({}));
        }, 250);
        return () => clearTimeout(id);
    }, [searchQuery]);

    // Preload a user's posts on first open (Sarah@Artane for now)
    React.useEffect(() => {
        fetchPostsByUser('Sarah@Artane', 30).then(setPreloadPosts).catch(() => setPreloadPosts([]));
    }, []);

    const goToLocation = (loc: string) => {
        sessionStorage.setItem('pendingLocation', loc);
        window.dispatchEvent(new CustomEvent('locationChange', { detail: { location: loc } }));
        nav('/feed?location=' + encodeURIComponent(loc));
    };

    const goToUser = (handle: string) => {
        nav('/user/' + encodeURIComponent(handle));
    };

    return (
        <div className="p-4 space-y-4">
            {/* Header removed per request */}

            {/* Search Bar */}
            <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => { setShowSearchMode(true); setIsFocused(true); }}
                    onBlur={() => setIsFocused(false)}
                    placeholder=""
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                {(!searchQuery) && (
                    <div className="pointer-events-none absolute left-10 right-4 top-1/2 -translate-y-1/2 select-none z-10">
                        <span
                            style={{
                                background: 'linear-gradient(90deg, #87ceeb, #ffb6c1, #87cefa, #c084fc, #34d399, #f59e0b, #ef4444, #dc2626, #fca5a5, #60a5fa, #fb7185, #87ceeb)',
                                backgroundSize: '200% 100%',
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                animation: 'shimmer 6s linear infinite'
                            }}
                        >
                            {placeholders[placeholderIndex]}
                        </span>
                    </div>
                )}
            </div>

            {/* Preloaded user grid (hidden when searching) */}
            {!showSearchMode && (!searchQuery.trim()) && preloadPosts && (
                <div className="px-1">
                    <div className="grid grid-cols-3 gap-1">
                        {preloadPosts.map((post) => (
                            <div key={post.id} className="aspect-square relative group bg-gray-900">
                                {post.mediaUrl ? (
                                    post.mediaType === 'video' ? (
                                        <video
                                            src={post.mediaUrl}
                                            className="w-full h-full object-cover"
                                            muted
                                            playsInline
                                            preload="metadata"
                                        />
                                    ) : (
                                        <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" />
                                    )
                                ) : (
                                    <div className="w-full h-full relative flex items-center justify-center p-3" style={{ background: '#0f172a' }}>
                                        <p className="text-white text-xs font-semibold text-center line-clamp-6">
                                            {post.text || 'No preview'}
                                        </p>
                                    </div>
                                )}
                                {post.locationLabel && (
                                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 rounded flex items-center gap-1">
                                        <FiMapPin className="w-3 h-3 text-white" />
                                        <span className="text-[10px] text-white font-medium">{post.locationLabel}</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-opacity" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Results with tabs */}
            {(showSearchMode && searchQuery.trim()) && (
                <div className="space-y-4">
                    <div className="flex gap-2">
                        {(['locations', 'users', 'posts'] as const).map(tab => {
                            const count = tab === 'locations' ? (sections.locations?.items?.length || 0)
                                : tab === 'users' ? (sections.users?.items?.length || 0)
                                    : (sections.posts?.items?.length || 0);
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-3 py-1.5 rounded-full text-sm border ${activeTab === tab ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700'}`}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}{count ? ` (${count})` : ''}
                                </button>
                            );
                        })}
                    </div>

                    {activeTab === 'locations' && (
                        <div>
                            {!(sections.locations?.items?.length) ? (
                                <div className="text-sm text-gray-500 dark:text-gray-400">No matching locations</div>
                            ) : (
                                <div className="divide-y divide-gray-200 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                                    {sections.locations!.items!.map((loc: any) => (
                                        <button
                                            key={`${loc.name}-${loc.country || ''}`}
                                            onClick={() => goToLocation(loc.name)}
                                            className="w-full text-left flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                                        >
                                            <div className="h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                                                <FiMapPin className="text-brand-600 dark:text-brand-400" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-gray-100">{loc.name}</div>
                                                <div className="text-xs text-gray-500">{loc.type}{loc.country ? ` • ${loc.country}` : ''}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {sections.locations?.nextCursor != null && (
                                <button
                                    onClick={async () => {
                                        const next = await unifiedSearch({ q: searchQuery.trim(), types: 'locations', locationsCursor: sections.locations?.nextCursor || 0, locationsLimit: 10 });
                                        setSections(s => ({
                                            ...s,
                                            locations: {
                                                items: [...(s.locations?.items || []), ...((next.sections.locations?.items) || [])],
                                                nextCursor: next.sections.locations?.nextCursor ?? null
                                            }
                                        }));
                                    }}
                                    className="mt-3 w-full py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm"
                                >Load more</button>
                            )}
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div>
                            {!(sections.users?.items?.length) ? (
                                <div className="text-sm text-gray-500 dark:text-gray-400">No users found</div>
                            ) : (
                                <div className="divide-y divide-gray-200 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                                    {sections.users!.items!.map((u: any) => (
                                        <button
                                            key={u.handle}
                                            onClick={() => goToUser(u.handle)}
                                            className="w-full text-left flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                                        >
                                            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                                <FiUsers className="text-gray-700 dark:text-gray-200" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-gray-100">{u.handle}</div>
                                                {u.display_name && <div className="text-xs text-gray-500">{u.display_name}</div>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {sections.users?.nextCursor != null && (
                                <button
                                    onClick={async () => {
                                        const next = await unifiedSearch({ q: searchQuery.trim(), types: 'users', usersCursor: sections.users?.nextCursor || 0, usersLimit: 10 });
                                        setSections(s => ({
                                            ...s,
                                            users: {
                                                items: [...(s.users?.items || []), ...((next.sections.users?.items) || [])],
                                                nextCursor: next.sections.users?.nextCursor ?? null
                                            }
                                        }));
                                    }}
                                    className="mt-3 w-full py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm"
                                >Load more</button>
                            )}
                        </div>
                    )}

                    {activeTab === 'posts' && (
                        <div>
                            {!(sections.posts?.items?.length) ? (
                                <div className="text-sm text-gray-500 dark:text-gray-400">No posts found</div>
                            ) : (
                                <div className="grid grid-cols-3 gap-1">
                                    {sections.posts!.items!.map((p: any) => (
                                        <div key={p.id} className="aspect-square relative bg-gray-900">
                                            {p.media_url ? (
                                                p.media_type === 'video' ? (
                                                    <>
                                                        <video src={p.media_url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="w-10 h-10 bg-black/60 rounded-full flex items-center justify-center">
                                                                <FiPlayCircle className="w-5 h-5 text-white" />
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <img src={p.media_url} alt="" className="w-full h-full object-cover" />
                                                )
                                            ) : (
                                                <div className="w-full h-full relative flex items-center justify-center p-3" style={{ background: '#0f172a' }}>
                                                    <p className="text-white text-xs font-semibold text-center line-clamp-6">{p.text_content || 'No preview'}</p>
                                                </div>
                                            )}
                                            {p.location_label && (
                                                <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 rounded flex items-center gap-1">
                                                    <FiMapPin className="w-3 h-3 text-white" />
                                                    <span className="text-[10px] text-white font-medium">{p.location_label}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {sections.posts?.nextCursor != null && (
                                <button
                                    onClick={async () => {
                                        const next = await unifiedSearch({ q: searchQuery.trim(), types: 'posts', postsCursor: sections.posts?.nextCursor || 0, postsLimit: 12 });
                                        setSections(s => ({
                                            ...s,
                                            posts: {
                                                items: [...(s.posts?.items || []), ...((next.sections.posts?.items) || [])],
                                                nextCursor: next.sections.posts?.nextCursor ?? null
                                            }
                                        }));
                                    }}
                                    className="mt-3 w-full py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm"
                                >Load more</button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Popular Tags removed per request */}
        </div>
    );
}

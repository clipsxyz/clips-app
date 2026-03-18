import React from 'react';
import { FiSearch, FiMapPin, FiUsers, FiPlayCircle, FiChevronLeft, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { fetchPostsByUser } from '../api/posts';
import { unifiedSearch, type SearchSections } from '../api/search';
import type { Post } from '../types';
import { useAuth } from '../context/Auth';
import { toggleFollow } from '../api/client';

const MOCK_TOP_LOCATIONS = [
    { name: 'New York', type: 'City', country: 'USA' },
    { name: 'Los Angeles', type: 'City', country: 'USA' },
    { name: 'London', type: 'City', country: 'UK' },
    { name: 'Paris', type: 'City', country: 'France' },
    { name: 'Berlin', type: 'City', country: 'Germany' },
    { name: 'Tokyo', type: 'City', country: 'Japan' },
    { name: 'Seoul', type: 'City', country: 'South Korea' },
    { name: 'Sydney', type: 'City', country: 'Australia' },
    { name: 'Dublin', type: 'City', country: 'Ireland' },
    { name: 'Dubai', type: 'City', country: 'UAE' },
];

const MOCK_TOP_VENUES = [
    { name: 'Madison Square Garden', type: 'Arena', country: 'USA', city: 'New York' },
    { name: 'Wembley Stadium', type: 'Stadium', country: 'UK', city: 'London' },
    { name: 'Camp Nou', type: 'Stadium', country: 'Spain', city: 'Barcelona' },
    { name: 'Allianz Arena', type: 'Stadium', country: 'Germany', city: 'Munich' },
    { name: 'Accor Arena', type: 'Arena', country: 'France', city: 'Paris' },
    { name: 'Staples Center', type: 'Arena', country: 'USA', city: 'Los Angeles' },
    { name: 'Sydney Opera House', type: 'Venue', country: 'Australia', city: 'Sydney' },
    { name: 'Croke Park', type: 'Stadium', country: 'Ireland', city: 'Dublin' },
];

const MOCK_USERS_BY_COUNTRY = [
    { handle: 'Sarah@Artane', display_name: 'Sarah from Artane', country: 'Ireland' },
    { handle: 'NewsDublin@City', display_name: 'Dublin City Updates', country: 'Ireland' },
    { handle: 'RioLocal@Brazil', display_name: 'Rio Local Stories', country: 'Brazil' },
    { handle: 'SaoPauloNow', display_name: 'São Paulo Now', country: 'Brazil' },
];

export default function SearchPage() {
    const nav = useNavigate();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = React.useState('');
    const [sections, setSections] = React.useState<SearchSections>({});
    const [placeholderIndex, setPlaceholderIndex] = React.useState(0);
    const [preloadPosts, setPreloadPosts] = React.useState<Post[] | null>(null);
    const [showSearchMode, setShowSearchMode] = React.useState(false);
    const [isFocused, setIsFocused] = React.useState(false);
    const [suggestedUsers, setSuggestedUsers] = React.useState<Array<{ handle: string; display_name?: string }>>([]);
    const [followBusyHandle, setFollowBusyHandle] = React.useState<string | null>(null);
    const [localFollowState, setLocalFollowState] = React.useState<Record<string, boolean>>({});

    // High-level search mode chips: location / venue / users / posts / near me
    type SearchMode = 'locations' | 'venues' | 'users' | 'posts' | 'nearby';
    const [searchMode, setSearchMode] = React.useState<SearchMode>('locations');
    const [activeTab, setActiveTab] = React.useState<'locations' | 'users' | 'posts'>('locations');

    // Carousel placeholder between two messages
    React.useEffect(() => {
        const id = setInterval(() => {
            setPlaceholderIndex(i => (i + 1) % 2);
        }, 2500);
        return () => clearInterval(id);
    }, []);

    const placeholders = [
        'Search locations, venues, people…',
        'Search people to follow near you'
    ];

    // Debounced unified search – manual search only returns results
    // for the active high-level tab (locations / venues / users / posts / nearby).
    React.useEffect(() => {
        const q = searchQuery.trim();
        const id = setTimeout(() => {
            if (!q) {
                setSections({});
                return;
            }

            let types: string;
            switch (searchMode) {
                case 'locations':
                case 'venues': // treat venues as a locations search
                    types = 'locations';
                    break;
                case 'nearby':
                case 'users':
                    types = 'users';
                    break;
                case 'posts':
                    types = 'posts';
                    break;
                default:
                    types = 'users,locations,posts';
            }

            unifiedSearch({ q, types, usersLimit: 10, locationsLimit: 10, postsLimit: 12 })
                .then(r => setSections(r.sections))
                .catch(() => setSections({}));
        }, 250);
        return () => clearTimeout(id);
    }, [searchQuery, searchMode]);

    // Preload a user's posts on first open (Sarah@Artane for now)
    React.useEffect(() => {
        fetchPostsByUser('Sarah@Artane', 30).then(setPreloadPosts).catch(() => setPreloadPosts([]));
    }, []);

    // When "Near me" is selected, automatically search for users in the user's local area
    React.useEffect(() => {
        if (searchMode === 'nearby' && user?.local) {
            setShowSearchMode(true);
            setActiveTab('users');
            setSearchQuery(user.local);
        }
    }, [searchMode, user?.local]);

    const goToLocation = (loc: string) => {
        sessionStorage.setItem('pendingLocation', loc);
        window.dispatchEvent(new CustomEvent('locationChange', { detail: { location: loc } }));
        nav('/feed?location=' + encodeURIComponent(loc));
    };

    const goToUser = (handle: string) => {
        nav('/user/' + encodeURIComponent(handle));
    };

    return (
        <div className="min-h-full bg-black">
            <div className="mx-auto w-full max-w-md px-4 pb-6 space-y-3">

            {/* Header */}
            <div className="flex items-center gap-2 pt-3 mb-1">
                <button
                    onClick={() => nav(-1)}
                    className="p-2 rounded-full hover:bg-gray-900/80 transition-colors"
                    aria-label="Back"
                >
                    <FiChevronLeft className="w-5 h-5 text-gray-200" />
                </button>
                <h1 className="text-base font-semibold text-white tracking-tight">Search</h1>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <div
                    className={
                        'transition-colors ' +
                        (isFocused ? 'p-[1.3px] rounded-[20px] bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500' : '')
                    }
                >
                    <div className="relative rounded-[20px] bg-[#101010] border border-[#272727]">
                        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => { setShowSearchMode(true); setIsFocused(true); }}
                            onBlur={() => setIsFocused(false)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const q = searchQuery.trim();
                                    if (!q) return;
                                    if (searchMode === 'locations') {
                                        goToLocation(q);
                                    }
                                }
                            }}
                            placeholder=""
                            className="w-full pl-10 pr-9 py-2.5 rounded-[20px] bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-transparent text-sm leading-tight"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-800 text-gray-400"
                                aria-label="Clear search"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
                {(!searchQuery) && (
                    <div className="pointer-events-none absolute left-10 right-4 top-1/2 -translate-y-1/2 select-none z-10 flex">
                        {(() => {
                            const text = placeholders[placeholderIndex];
                            const prefix = 'Search for ';
                            const hasPrefix = text.startsWith(prefix);
                            const rest = hasPrefix ? text.slice(prefix.length) : text;
                            return (
                                <>
                                    {hasPrefix && (
                                        <span className="text-sm font-medium text-gray-500 mr-1">
                                            {prefix.trimEnd()}
                                        </span>
                                    )}
                                    {rest && (
                                        <span className="text-sm font-semibold text-white">
                                            {rest}
                                        </span>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* Mode chips */}
            <div className="flex gap-1.5 overflow-x-auto pt-1 pb-1 scrollbar-hide">
                {([
                    { id: 'locations', label: 'Location' },
                    { id: 'venues', label: 'Venue' },
                    { id: 'nearby', label: 'Near me' },
                    { id: 'users', label: 'Users' },
                    { id: 'posts', label: 'Posts' },
                ] as { id: SearchMode; label: string }[]).map((chip) => {
                    const active = searchMode === chip.id;
                    return (
                        <button
                            key={chip.id}
                            onClick={() => {
                                if (chip.id === 'nearby') {
                                    const local = user?.local || 'Local';
                                    try {
                                        sessionStorage.setItem('pendingLocation', local);
                                        window.dispatchEvent(new CustomEvent('locationChange', { detail: { location: local } }));
                                    } catch { }
                                    nav(`/feed?location=${encodeURIComponent(local)}`);
                                    return;
                                }
                                setSearchMode(chip.id);
                                // For Locations, keep the preloaded grid visible until the user starts typing
                                if (chip.id === 'locations') {
                                    setShowSearchMode(false);
                                } else if (chip.id === 'posts') {
                                    setShowSearchMode(false);
                                }
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                                active
                                    ? 'bg-white text-gray-900 border-white'
                                    : 'bg-[#101010] text-gray-300 border-[#2a2a2a] hover:border-gray-600'
                            }`}
                        >
                            {chip.label}
                        </button>
                    );
                })}
            </div>

            {/* Outer card */}
            <div className="mt-1 rounded-3xl bg-[#050505] border border-[#181818] shadow-[0_18px_60px_rgba(0,0,0,0.85)] overflow-hidden">

            {/* Popular venues when Venue mode is active */}
            {searchMode === 'venues' && (
                <div className="px-3 pt-3 pb-3 border-b border-[#181818] space-y-3 bg-gradient-to-r from-[#050510] via-[#050507] to-[#050510]">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.18em]">
                            Popular venues
                        </span>
                        <span className="text-[11px] text-gray-500">
                            Tap a venue to see posts
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {MOCK_TOP_VENUES.map((v, index) => {
                            const accentColors = [
                                'from-purple-500/80 via-pink-500/70 to-orange-400/80',
                                'from-sky-500/80 via-cyan-400/80 to-emerald-400/80',
                                'from-amber-500/80 via-orange-500/80 to-rose-500/80',
                                'from-indigo-500/80 via-violet-500/80 to-fuchsia-500/80',
                                'from-emerald-500/80 via-lime-400/80 to-teal-400/80',
                                'from-red-500/80 via-rose-500/80 to-yellow-400/80',
                            ];
                            const accent = accentColors[index % accentColors.length];
                            return (
                            <button
                                key={v.name}
                                type="button"
                                onClick={() => goToLocation(v.city || v.name)}
                                className="group relative overflow-hidden rounded-2xl bg-[#050509] border border-white/10 px-3 py-2.5 text-left text-xs text-gray-100 shadow-sm"
                            >
                                <div className={`pointer-events-none absolute inset-0 opacity-80 bg-gradient-to-br ${accent}`} />
                                <div className="relative flex flex-col gap-1">
                                    <div className="inline-flex items-center gap-1.5">
                                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/60 border border-white/10">
                                            <FiMapPin className="w-3 h-3 text-pink-300" />
                                        </span>
                                        <span className="truncate font-medium">{v.name}</span>
                                    </div>
                                    <span className="text-[10px] text-gray-500 group-hover:text-gray-200 transition-colors truncate">
                                        {v.type}{v.city ? ` • ${v.city}` : ''}{v.country ? ` • ${v.country}` : ''}
                                    </span>
                                </div>
                            </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Popular locations (always visible on Locations mode) */}
            {searchMode === 'locations' && (
                <div className="px-3 pt-3 pb-3 border-b border-[#181818] space-y-3 bg-gradient-to-r from-[#050510] via-[#050507] to-[#050510]">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.18em]">
                            Quick picks
                        </span>
                        <span className="text-[11px] text-gray-500">
                            Tap to jump feed
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            'Paris', 'London', 'Rome', 'Madrid', 'Berlin',
                            'Amsterdam', 'Lisbon', 'Vienna', 'Prague',
                            'Dublin', 'Cork', 'Galway', 'Belfast',
                            'New York', 'Los Angeles', 'Chicago',
                        ].map((city, index) => {
                            const iconColors = [
                                'text-sky-400',
                                'text-pink-400',
                                'text-emerald-400',
                                'text-amber-400',
                                'text-purple-400',
                                'text-red-400',
                            ];
                            const iconClass = iconColors[index % iconColors.length];
                            return (
                                <button
                                    key={city}
                                    type="button"
                                    onClick={() => goToLocation(city)}
                                    className="rounded-2xl bg-black/60 border border-white/10 px-2.5 py-2 text-[11px] text-gray-100 shadow-sm hover:bg-black/80 transition-colors"
                                >
                                    <div className="flex flex-col gap-1 items-start">
                                        <div className="inline-flex items-center gap-1.5">
                                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/5 border border-white/15">
                                                <FiMapPin className={`w-3 h-3 ${iconClass}`} />
                                            </span>
                                            <span className="truncate font-medium">{city}</span>
                                        </div>
                                        <span className="text-[10px] text-gray-500">
                                            Live news near here
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Prefixed users (country-based). No nested Locations/Users/Posts tabs. */}
            {searchMode === 'users' && (
                <div className="px-3 pt-3 pb-3 border-b border-[#181818] space-y-3">
                    {(() => {
                        const countryKey = (searchQuery.trim() || user?.national || '').toLowerCase();
                        const prefixedUsers = MOCK_USERS_BY_COUNTRY.filter(
                            (u) => u.country.toLowerCase() === countryKey && u.handle !== user?.handle
                        );

                        const titleCountry = countryKey ? countryKey.charAt(0).toUpperCase() + countryKey.slice(1) : 'your country';

                        if (!countryKey) {
                            return (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    Set your national country in registration/profile to see suggestions.
                                </div>
                            );
                        }

                        if (!prefixedUsers.length) {
                            return (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    No stories in {titleCountry} yet
                                </div>
                            );
                        }

                        return (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.18em]">
                                        Suggested to follow
                                    </span>
                                    <span className="text-[11px] text-gray-500">{titleCountry}</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {prefixedUsers.map((u) => {
                                        const isFollowing = !!localFollowState[u.handle];
                                        const busy = followBusyHandle === u.handle;
                                        return (
                                            <div
                                                key={u.handle}
                                                className="flex items-center justify-between rounded-2xl bg-[#050509] border border-white/10 px-3 py-2.5 text-xs text-gray-100"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => goToUser(u.handle)}
                                                    className="flex items-center gap-2 text-left"
                                                >
                                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 border border-white/10">
                                                        <FiUsers className="w-4 h-4 text-gray-200" />
                                                    </span>
                                                    <span className="flex flex-col">
                                                        <span className="font-medium">{u.display_name || u.handle}</span>
                                                        <span className="text-[11px] text-gray-400">@{u.handle}</span>
                                                    </span>
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={async () => {
                                                        if (busy) return;
                                                        setFollowBusyHandle(u.handle);
                                                        try {
                                                            await toggleFollow(u.handle);
                                                            setLocalFollowState((prev) => ({
                                                                ...prev,
                                                                [u.handle]: !prev[u.handle],
                                                            }));
                                                        } finally {
                                                            setFollowBusyHandle(null);
                                                        }
                                                    }}
                                                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                                                        isFollowing
                                                            ? 'bg-white text-gray-900 border-white'
                                                            : 'bg-transparent text-white border-white/60 hover:bg-white/10'
                                                    } ${busy ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                >
                                                    {isFollowing ? 'Following' : 'Follow'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Preloaded user grid (hidden when searching). Do NOT show on Location/Venue/Users modes for this page. */}
            {searchMode === 'posts' && !showSearchMode && (!searchQuery.trim()) && preloadPosts && (
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

            {/* Manual search results – restricted to the active high-level tab */}
            {showSearchMode && searchQuery.trim() && (
                <div className="space-y-4 px-3 pt-3 pb-2">
                    {/* Locations results when in Location tab */}
                    {searchMode === 'locations' && (
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
                        </div>
                    )}

                    {/* Venue tab: treat manual search as locations-only */}
                    {searchMode === 'venues' && (
                        <div>
                            {!(sections.locations?.items?.length) ? (
                                <div className="text-sm text-gray-500 dark:text-gray-400">No matching venues</div>
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
                        </div>
                    )}

                    {/* Users results when in Users tab */}
                    {searchMode === 'users' && (
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
                        </div>
                    )}

                    {/* Nearby tab reuses users-search but with local empty-state text */}
                    {searchMode === 'nearby' && (
                        <div>
                            {!(sections.users?.items?.length) ? (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {`No stories in ${user?.local || 'your area'} yet`}
                                </div>
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
                        </div>
                    )}

                    {/* Posts results when in Posts tab */}
                    {searchMode === 'posts' && (
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
                        </div>
                    )}
                </div>
            )}

            {/* Popular Tags removed per request */}
            </div>
        </div>
    </div>
    );
}

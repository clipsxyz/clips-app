import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    IoArrowBack,
    IoBookmark,
    IoBookmarkOutline,
    IoBusiness,
    IoBusinessOutline,
    IoCloseCircle,
    IoFlag,
    IoFlagOutline,
    IoLocation,
    IoLocationOutline,
    IoNavigateOutline,
    IoPeopleOutline,
    IoSearch,
} from 'react-icons/io5';
import { useAuth } from '../context/Auth';
import { unifiedSearch, type SearchSections } from '../api/search';
import { searchLocations, searchLocalGazetteer, type LocationSuggestion } from '../api/locations';
import { rewriteMediaUrlForClient } from '../api/apiBaseUrl';
import { hasPendingFollowRequest } from '../api/privacy';
import { followOrRequest } from '../utils/followOrRequest';
import { getPlaceFeedPickerOptions, resolvePlaceFeedSelection, type PlaceFeedSelection } from '../utils/pickPlaceFeedScope';
import { parsedPlaceFeedFromSuggestion } from '../utils/placeFeedLevels';
import Avatar from '../components/Avatar';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet';
import type { Post } from '../types';

type SearchMode = 'locations' | 'venues' | 'landmarks' | 'users' | 'posts' | 'nearby';
type SearchRefinement = 'all' | 'local' | 'regional';
type RecentSearchItem = { q: string; mode: SearchMode; ts: number };

const RECENT_SEARCHES_KEY = 'searchRecentQueriesV1';
const SAVED_SEARCHES_KEY = 'searchSavedQueriesV1';
const MAX_RECENT_SEARCHES = 8;

const QUICK_PICK_CITIES = [
    'Paris', 'London', 'Rome', 'Madrid', 'Berlin',
    'Amsterdam', 'Lisbon', 'Vienna', 'Prague',
    'Dublin', 'Cork', 'Galway', 'Belfast',
    'New York', 'Los Angeles', 'Chicago',
];

const POPULAR_VENUES = [
    'Madison Square Garden', 'Wembley Stadium', 'Camp Nou', 'Allianz Arena',
    'Accor Arena', 'Staples Center', 'Sydney Opera House', 'Croke Park',
];
const POPULAR_LANDMARKS = [
    'Phoenix Park', 'River Liffey', 'Eiffel Tower', 'Big Ben',
    'Statue of Liberty', 'Golden Gate Bridge',
];

const MODE_CHIPS: Array<{ id: SearchMode; label: string; icon: React.ReactNode; activeIcon: React.ReactNode }> = [
    { id: 'locations', label: 'Location', icon: <IoLocationOutline size={14} />, activeIcon: <IoLocationOutline size={14} /> },
    { id: 'venues', label: 'Venue', icon: <IoBusinessOutline size={14} />, activeIcon: <IoBusinessOutline size={14} /> },
    { id: 'landmarks', label: 'Landmark', icon: <IoFlagOutline size={14} />, activeIcon: <IoFlagOutline size={14} /> },
    { id: 'nearby', label: 'Near me', icon: <IoNavigateOutline size={14} />, activeIcon: <IoNavigateOutline size={14} /> },
    { id: 'users', label: 'Users', icon: <IoPeopleOutline size={14} />, activeIcon: <IoPeopleOutline size={14} /> },
];

function readSearchList(key: string): RecentSearchItem[] {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((x: any) => x && typeof x.q === 'string' && typeof x.mode === 'string');
    } catch {
        return [];
    }
}

function writeSearchList(key: string, items: RecentSearchItem[]) {
    try {
        localStorage.setItem(key, JSON.stringify(items));
    } catch {
        /* ignore */
    }
}

function avatarSrc(url?: string | null) {
    const raw = typeof url === 'string' ? url.trim() : '';
    return raw ? rewriteMediaUrlForClient(raw) : undefined;
}

function postThumb(post: Post): string {
    const poster = post.videoPosterUrl || post.thumbnailUrl;
    if (poster) return poster;
    if (post.mediaType === 'video') return '';
    return post.mediaUrl || '';
}

/** Web twin of SearchScreen. */
export default function SearchPage() {
    const nav = useNavigate();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = React.useState('');
    const [sections, setSections] = React.useState<SearchSections>({});
    const [loading, setLoading] = React.useState(false);
    const [searchMode, setSearchMode] = React.useState<SearchMode>('locations');
    const [refinement, setRefinement] = React.useState<SearchRefinement>('all');
    const [sectionLoadingMore, setSectionLoadingMore] = React.useState({ users: false, locations: false, posts: false });
    const [recentSearches, setRecentSearches] = React.useState<RecentSearchItem[]>(() => readSearchList(RECENT_SEARCHES_KEY));
    const [savedSearches, setSavedSearches] = React.useState<RecentSearchItem[]>(() => readSearchList(SAVED_SEARCHES_KEY));
    const [followBusyHandle, setFollowBusyHandle] = React.useState<string | null>(null);
    const [localFollowState, setLocalFollowState] = React.useState<Record<string, boolean>>({});
    const [localRequestState, setLocalRequestState] = React.useState<Record<string, boolean>>({});
    const [suggestedUsers, setSuggestedUsers] = React.useState<Array<{ handle: string; display_name?: string; avatar_url?: string }>>([]);
    const [placeSuggestions, setPlaceSuggestions] = React.useState<LocationSuggestion[]>([]);
    const [placeSuggestionsLoading, setPlaceSuggestionsLoading] = React.useState(false);
    const [scopePicker, setScopePicker] = React.useState<LocationSuggestion | null>(null);
    const [alertSheet, setAlertSheet] = React.useState<{ title: string; message: string } | null>(null);

    const modePlaceholder: Record<SearchMode, string> = {
        locations: 'Search by location',
        venues: 'Search by venue',
        landmarks: 'Search by landmark',
        users: 'Search users',
        posts: 'Search posts',
        nearby: 'Search nearby users',
    };

    const isPlaceSearchMode = searchMode === 'locations' || searchMode === 'venues' || searchMode === 'landmarks';
    const query = searchQuery.trim();
    const hasQuery = query.length > 0;
    const isCurrentQuerySaved = savedSearches.some((x) => x.q.toLowerCase() === query.toLowerCase() && x.mode === searchMode);

    React.useEffect(() => {
        const q = searchQuery.trim();
        if (!isPlaceSearchMode || q.length < 2) {
            setPlaceSuggestions([]);
            setPlaceSuggestionsLoading(false);
            return;
        }
        const modeForApi = searchMode === 'venues' ? 'venue' : searchMode === 'landmarks' ? 'landmark' : 'location';
        setPlaceSuggestions(searchLocalGazetteer(q, 8, modeForApi));
        const ctrl = new AbortController();
        const id = window.setTimeout(() => {
            setPlaceSuggestionsLoading(true);
            searchLocations(q, 8, modeForApi, ctrl.signal)
                .then((res) => {
                    if (!ctrl.signal.aborted) setPlaceSuggestions(res);
                })
                .catch((err) => {
                    if (!ctrl.signal.aborted && (err as Error)?.name !== 'AbortError') {
                        setPlaceSuggestions(searchLocalGazetteer(q, 8, modeForApi));
                    }
                })
                .finally(() => {
                    if (!ctrl.signal.aborted) setPlaceSuggestionsLoading(false);
                });
        }, 120);
        return () => {
            ctrl.abort();
            window.clearTimeout(id);
        };
    }, [searchQuery, searchMode, isPlaceSearchMode]);

    React.useEffect(() => {
        const q = searchQuery.trim();
        if (!q) {
            setSections({});
            setLoading(false);
            return;
        }
        setLoading(true);
        const id = window.setTimeout(() => {
            let types = 'users,locations,posts';
            if (searchMode === 'users' || searchMode === 'nearby') types = 'users';
            if (searchMode === 'posts') types = 'posts';
            if (searchMode === 'venues' || searchMode === 'landmarks') types = 'locations';
            unifiedSearch({ q, types, usersLimit: 10, locationsLimit: 10, postsLimit: 12 })
                .then((r) => {
                    setSections(r.sections || {});
                    setLoading(false);
                })
                .catch(() => {
                    setSections({});
                    setLoading(false);
                });
        }, 250);
        return () => window.clearTimeout(id);
    }, [searchQuery, searchMode]);

    React.useEffect(() => {
        const q = (user?.local || '').trim() || 'Dublin';
        unifiedSearch({ q, types: 'users', usersLimit: 8 })
            .then((r) => {
                const items = Array.isArray(r.sections?.users?.items) ? r.sections.users.items : [];
                setSuggestedUsers(items);
                if (user?.handle) {
                    const nextRequests: Record<string, boolean> = {};
                    for (const item of items) {
                        if (item?.handle && hasPendingFollowRequest(user.handle, item.handle)) {
                            nextRequests[item.handle] = true;
                        }
                    }
                    if (Object.keys(nextRequests).length > 0) {
                        setLocalRequestState((prev) => ({ ...prev, ...nextRequests }));
                    }
                }
            })
            .catch(() => setSuggestedUsers([]));
    }, [user?.local, user?.handle]);

    React.useEffect(() => {
        if (searchMode === 'nearby') {
            const target = user?.local;
            if (target && target.trim().length > 0) setSearchQuery(target);
        }
    }, [searchMode, user?.local]);

    const addRecentSearch = React.useCallback((q: string, mode: SearchMode) => {
        const nextQuery = q.trim();
        if (!nextQuery) return;
        setRecentSearches((prev) => {
            const next = [
                { q: nextQuery, mode, ts: Date.now() },
                ...prev.filter((x) => !(x.q.toLowerCase() === nextQuery.toLowerCase() && x.mode === mode)),
            ].slice(0, MAX_RECENT_SEARCHES);
            writeSearchList(RECENT_SEARCHES_KEY, next);
            return next;
        });
    }, []);

    const toggleSaveSearch = React.useCallback((q: string, mode: SearchMode) => {
        const nextQuery = q.trim();
        if (!nextQuery) return;
        setSavedSearches((prev) => {
            const exists = prev.some((x) => x.q.toLowerCase() === nextQuery.toLowerCase() && x.mode === mode);
            const next = exists
                ? prev.filter((x) => !(x.q.toLowerCase() === nextQuery.toLowerCase() && x.mode === mode))
                : [{ q: nextQuery, mode, ts: Date.now() }, ...prev].slice(0, MAX_RECENT_SEARCHES);
            writeSearchList(SAVED_SEARCHES_KEY, next);
            return next;
        });
    }, []);

    const filteredLocations = React.useMemo(() => {
        const items = Array.isArray(sections.locations?.items) ? sections.locations.items : [];
        if (refinement === 'all') return items;
        const local = (user?.local || '').toLowerCase();
        const regional = (user?.regional || '').toLowerCase();
        return items.filter((loc: any) => {
            const hay = `${loc?.name || ''} ${loc?.country || ''} ${loc?.type || ''}`.toLowerCase();
            if (refinement === 'local') return !!local && hay.includes(local);
            if (refinement === 'regional') return !!regional && hay.includes(regional);
            return true;
        });
    }, [sections.locations?.items, refinement, user?.local, user?.regional]);

    const filteredUsers = React.useMemo(() => {
        const items = Array.isArray(sections.users?.items) ? sections.users.items : [];
        if (refinement === 'all') return items;
        const local = (user?.local || '').toLowerCase();
        const regional = (user?.regional || '').toLowerCase();
        return items.filter((u: any) => {
            const hay = [u?.handle, u?.display_name, u?.local, u?.regional, u?.national, u?.location, u?.city, u?.country]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            if (refinement === 'local') return !!local && hay.includes(local);
            if (refinement === 'regional') return !!regional && hay.includes(regional);
            return true;
        });
    }, [sections.users?.items, refinement, user?.local, user?.regional]);

    const filteredPosts: Post[] = Array.isArray(sections.posts?.items) ? sections.posts.items : [];

    function openFeedSelection(selection: PlaceFeedSelection, kind: 'location' | 'venue' | 'landmark' = 'location') {
        addRecentSearch(selection.label, searchMode);
        try {
            sessionStorage.setItem('pendingLocation', selection.filter);
            sessionStorage.setItem('pendingLocationLabel', selection.label);
            sessionStorage.setItem('pendingLocationScope', selection.scope);
            sessionStorage.setItem('pendingFilterType', kind);
            if (selection.placeId) sessionStorage.setItem('pendingLocationPlaceId', selection.placeId);
            else sessionStorage.removeItem('pendingLocationPlaceId');
            window.dispatchEvent(
                new CustomEvent('locationChange', {
                    detail: {
                        location: selection.filter,
                        locationLabel: selection.label,
                        locationScope: selection.scope,
                        filterType: kind,
                        placeId: selection.placeId ?? null,
                    },
                }),
            );
        } catch {
            /* ignore */
        }
        const params = new URLSearchParams({
            location: selection.filter,
            label: selection.label,
            scope: selection.scope,
        });
        if (kind === 'venue') params.set('type', 'venue');
        else if (kind === 'landmark') params.set('type', 'landmark');
        if (selection.placeId) params.set('place_id', selection.placeId);
        nav(`/feed?${params.toString()}`);
    }

    function goToLocation(loc: string, kind: 'location' | 'venue' | 'landmark' = 'location') {
        const suggestion: LocationSuggestion = {
            name: loc,
            type: kind,
            country: loc,
            national: loc,
            local: loc,
            regional: loc,
        };
        if (kind === 'location' && getPlaceFeedPickerOptions(suggestion)) {
            setScopePicker(suggestion);
            return;
        }
        openFeedSelection(resolvePlaceFeedSelection(suggestion), kind);
    }

    function onPlaceSuggestionPress(suggestion: LocationSuggestion) {
        const kind = searchMode === 'venues' ? 'venue' : searchMode === 'landmarks' ? 'landmark' : 'location';
        const typed: LocationSuggestion = kind === 'venue' || kind === 'landmark' ? { ...suggestion, type: kind } : suggestion;
        if (kind !== 'location') {
            openFeedSelection(resolvePlaceFeedSelection(typed), kind);
            return;
        }
        if (getPlaceFeedPickerOptions(typed)) {
            setScopePicker(typed);
            return;
        }
        openFeedSelection(resolvePlaceFeedSelection(typed), 'location');
    }

    function goToUser(handle: string) {
        addRecentSearch(handle, searchMode);
        nav('/user/' + encodeURIComponent(handle));
    }

    function goToPost(postId: string) {
        nav('/post/' + encodeURIComponent(postId));
    }

    function handleSubmitSearch() {
        const q = searchQuery.trim();
        if (!q) return;
        if (searchMode === 'locations' || searchMode === 'venues' || searchMode === 'landmarks') {
            const kind = searchMode === 'venues' ? 'venue' : searchMode === 'landmarks' ? 'landmark' : 'location';
            if (placeSuggestions.length > 0) {
                onPlaceSuggestionPress(placeSuggestions[0]);
                return;
            }
            goToLocation(q, kind);
            return;
        }
        if (searchMode === 'users' || searchMode === 'nearby') {
            goToUser(q);
        }
    }

    async function loadMoreSection(section: 'users' | 'locations' | 'posts') {
        const q = searchQuery.trim();
        if (!q || sectionLoadingMore[section]) return;
        const cursor = sections[section]?.nextCursor;
        if (cursor == null) return;
        setSectionLoadingMore((prev) => ({ ...prev, [section]: true }));
        try {
            const params: any = {
                q,
                types: section,
                usersLimit: section === 'users' ? 10 : undefined,
                locationsLimit: section === 'locations' ? 10 : undefined,
                postsLimit: section === 'posts' ? 12 : undefined,
            };
            if (section === 'users') params.usersCursor = cursor;
            if (section === 'locations') params.locationsCursor = cursor;
            if (section === 'posts') params.postsCursor = cursor;
            const r = await unifiedSearch(params);
            const incoming = r.sections?.[section];
            const incomingItems = Array.isArray(incoming?.items) ? incoming.items : [];
            setSections((prev) => {
                const prevItems = Array.isArray(prev?.[section]?.items) ? prev[section]!.items : [];
                const merged = [...prevItems];
                const seen = new Set(prevItems.map((i: any) => String(i?.id ?? i?.handle ?? i?.name ?? JSON.stringify(i))));
                incomingItems.forEach((item: any) => {
                    const key = String(item?.id ?? item?.handle ?? item?.name ?? JSON.stringify(item));
                    if (!seen.has(key)) {
                        merged.push(item);
                        seen.add(key);
                    }
                });
                return {
                    ...prev,
                    [section]: {
                        items: merged,
                        nextCursor: incoming?.nextCursor ?? null,
                        hasMore: incoming?.hasMore ?? false,
                    },
                };
            });
        } finally {
            setSectionLoadingMore((prev) => ({ ...prev, [section]: false }));
        }
    }

    async function onToggleFollowSuggested(handle: string) {
        if (!user?.id || !user?.handle) {
            setAlertSheet({ title: 'Sign in required', message: 'Log in to follow people.' });
            return;
        }
        setFollowBusyHandle(handle);
        try {
            const wasFollowing = localFollowState[handle] === true;
            const wasRequested = localRequestState[handle] === true || Boolean(user.handle && hasPendingFollowRequest(user.handle, handle));
            const nextFollowing = wasFollowing ? false : wasRequested ? false : true;
            const result = await followOrRequest({
                userId: String(user.id),
                targetHandle: handle,
                viewerHandle: user.handle,
                nextFollowing,
            });
            setLocalFollowState((prev) => ({ ...prev, [handle]: result.following }));
            setLocalRequestState((prev) => ({ ...prev, [handle]: result.requested }));
            if (result.requested && !wasRequested) {
                setAlertSheet({
                    title: 'Follow Request Sent',
                    message: `Your follow request was sent to ${handle}. You'll be notified when they respond.`,
                });
            }
        } catch {
            setAlertSheet({ title: 'Action failed', message: 'Could not update follow status right now.' });
        } finally {
            setFollowBusyHandle(null);
        }
    }

    function onModeChipPress(id: SearchMode) {
        if (id === 'nearby') {
            const local = user?.local || 'Local';
            openFeedSelection({ filter: local, scope: 'local', label: local, fullName: local }, 'location');
            return;
        }
        setSearchMode(id);
    }

    const placeKind = searchMode === 'venues' ? 'venue' : searchMode === 'landmarks' ? 'landmark' : 'location';
    const placeIcon = placeKind === 'venue' ? IoBusiness : placeKind === 'landmark' ? IoFlag : IoLocation;
    const PlaceIcon = placeIcon;

    return (
        <div className="min-h-full bg-black text-white">
            <div className="sticky top-0 z-20 bg-black px-4 pb-2.5 pt-2">
                <div className="mb-2.5 flex items-center gap-2">
                    <button type="button" onClick={() => nav(-1)} className="-ml-1 p-1" aria-label="Go back">
                        <IoArrowBack size={22} color="#fff" />
                    </button>
                    <h1 className="text-[17px] font-bold tracking-[-0.2px] text-white">Search</h1>
                </div>
                <div className="flex items-center gap-2 rounded-[20px] border border-white/15 bg-white/[0.07] px-3.5 py-[11px]">
                    <IoSearch size={18} className="shrink-0 text-white/60" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSubmitSearch();
                        }}
                        placeholder={modePlaceholder[searchMode]}
                        aria-label={modePlaceholder[searchMode]}
                        autoCorrect="off"
                        autoCapitalize="none"
                        className="min-w-0 flex-1 bg-transparent text-sm text-[#F3F4F6] placeholder:text-[#6B7280] focus:outline-none"
                    />
                    {searchQuery ? (
                        <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search">
                            <IoCloseCircle size={18} color="#6B7280" />
                        </button>
                    ) : null}
                </div>

                {isPlaceSearchMode && query.length >= 2 ? (
                    <div className="mt-2.5 max-h-[260px] overflow-y-auto rounded-2xl border border-[#272727] bg-[#101010]">
                        {placeSuggestionsLoading && placeSuggestions.length === 0 ? (
                            <p className="px-3.5 py-3 text-[13px] text-[#9CA3AF]">Searching…</p>
                        ) : null}
                        {!placeSuggestionsLoading && placeSuggestions.length === 0 ? (
                            <p className="px-3.5 py-3 text-[13px] text-[#9CA3AF]">No places found. Try another spelling.</p>
                        ) : null}
                        {placeSuggestions.slice(0, 8).map((s, idx) => (
                            <button
                                key={`${s.type}-${s.name}-${idx}`}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => onPlaceSuggestionPress(s)}
                                className="flex w-full items-center gap-2.5 border-b border-white/[0.08] px-3.5 py-3 text-left last:border-b-0"
                            >
                                <PlaceIcon size={18} color="#A78BFA" className="shrink-0" />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-[#F9FAFB]">{s.display_name || s.name}</span>
                                    <span className="mt-0.5 block text-[11px] text-[#9CA3AF]">
                                        {placeKind === 'venue' ? 'Venue' : placeKind === 'landmark' ? 'Landmark' : 'Location'}
                                        {s.country ? ` · ${s.country}` : ''}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                ) : null}

                <div className="mt-2.5 flex gap-2 overflow-x-auto py-0.5 [scrollbar-width:none]">
                    {MODE_CHIPS.map((chip) => {
                        const active = searchMode === chip.id;
                        return (
                            <button
                                key={chip.id}
                                type="button"
                                onClick={() => onModeChipPress(chip.id)}
                                className={`flex shrink-0 items-center gap-1.5 rounded-2xl border px-3.5 py-[9px] text-xs font-semibold ${
                                    active
                                        ? 'border-white bg-white/[0.22] text-white'
                                        : 'border-white/15 bg-white/[0.06] text-[#E5E7EB]'
                                }`}
                            >
                                {active ? chip.activeIcon : chip.icon}
                                {chip.label}
                            </button>
                        );
                    })}
                </div>

                {hasQuery && (searchMode === 'users' || searchMode === 'posts') ? (
                    <div className="mt-2.5 flex items-center gap-2">
                        {([
                            { id: 'all', label: 'All' },
                            { id: 'local', label: 'Local' },
                            { id: 'regional', label: 'Regional' },
                        ] as const).map((r) => {
                            const active = refinement === r.id;
                            return (
                                <button
                                    key={r.id}
                                    type="button"
                                    onClick={() => setRefinement(r.id)}
                                    className={`rounded-full border px-2.5 py-[5px] text-[11px] font-bold ${
                                        active
                                            ? 'border-[#F8D26A] bg-[#3F2B07] text-[#F8D26A]'
                                            : 'border-[#2a2a2a] bg-[#0d0d0f] text-[#D1D5DB]'
                                    }`}
                                >
                                    {r.label}
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={() => toggleSaveSearch(searchQuery, searchMode)}
                            className="ml-auto p-1"
                            aria-label={isCurrentQuerySaved ? 'Remove saved search' : 'Save search'}
                        >
                            {isCurrentQuerySaved ? <IoBookmark size={16} color="#F8D26A" /> : <IoBookmarkOutline size={16} color="#F8D26A" />}
                        </button>
                    </div>
                ) : null}
            </div>

            {loading ? (
                <div className="flex flex-1 items-center justify-center py-16">
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" aria-label="Loading" />
                </div>
            ) : hasQuery ? (
                <div>
                    {searchMode === 'users' || searchMode === 'nearby' ? (
                        <div>
                            {filteredUsers.map((u: any) => (
                                <button
                                    key={u.handle}
                                    type="button"
                                    onClick={() => goToUser(u.handle)}
                                    className="flex w-full items-center gap-3 border-b border-[#1F2937] px-4 py-3 text-left"
                                >
                                    <Avatar
                                        src={avatarSrc(u.avatar_url || u.avatarUrl)}
                                        name={(u.handle || 'User').split('@')[0]}
                                        size={40}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[15px] font-semibold text-white">{u.handle}</span>
                                        <span className="mt-0.5 block text-[13px] text-[#9CA3AF]">{u.display_name || 'User'}</span>
                                    </span>
                                </button>
                            ))}
                            {sections.users?.nextCursor != null ? (
                                <button
                                    type="button"
                                    onClick={() => void loadMoreSection('users')}
                                    className="m-3 w-[calc(100%-24px)] rounded-[10px] border border-[#2a2a2a] bg-[#0d0d0f] py-2.5 text-[13px] font-bold text-[#E5E7EB]"
                                >
                                    {sectionLoadingMore.users ? 'Loading…' : 'Load more users'}
                                </button>
                            ) : null}
                        </div>
                    ) : null}

                    {searchMode === 'locations' || searchMode === 'venues' || searchMode === 'landmarks' ? (
                        <div>
                            {filteredLocations.map((loc: any) => {
                                const kind = searchMode === 'venues' ? 'venue' : searchMode === 'landmarks' ? 'landmark' : 'location';
                                const kindLabel = kind === 'venue' ? 'Venue' : kind === 'landmark' ? 'Landmark' : 'Location';
                                const RowIcon = kind === 'venue' ? IoBusiness : kind === 'landmark' ? IoFlag : IoLocation;
                                return (
                                    <button
                                        key={`${loc.name}-${loc.country || ''}`}
                                        type="button"
                                        onClick={() => goToLocation(loc.name, kind)}
                                        className="flex w-full items-center gap-3 border-b border-[#1F2937] px-4 py-3 text-left"
                                    >
                                        <RowIcon size={20} color="#A78BFA" className="shrink-0" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[15px] font-semibold text-white">{loc.name}</span>
                                            <span className="mt-0.5 block text-[13px] text-[#9CA3AF]">
                                                {kindLabel}
                                                {loc.type ? ` • ${loc.type}` : ''}
                                                {loc.country ? ` • ${loc.country}` : ''}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                            {sections.locations?.nextCursor != null ? (
                                <button
                                    type="button"
                                    onClick={() => void loadMoreSection('locations')}
                                    className="m-3 w-[calc(100%-24px)] rounded-[10px] border border-[#2a2a2a] bg-[#0d0d0f] py-2.5 text-[13px] font-bold text-[#E5E7EB]"
                                >
                                    {sectionLoadingMore.locations ? 'Loading…' : 'Load more places'}
                                </button>
                            ) : null}
                        </div>
                    ) : null}

                    {searchMode === 'posts' ? (
                        <div className="flex flex-wrap p-px">
                            {filteredPosts.map((post) => {
                                const thumb = postThumb(post);
                                return (
                                    <button
                                        key={post.id}
                                        type="button"
                                        onClick={() => goToPost(String(post.id))}
                                        className="aspect-square w-1/3 p-px"
                                    >
                                        {thumb ? (
                                            <img src={rewriteMediaUrlForClient(thumb)} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="flex h-full w-full items-center bg-[#111] p-2 text-left text-[11px] text-[#9CA3AF]">
                                                {(post.text || post.caption || 'Post').slice(0, 80)}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                            {sections.posts?.nextCursor != null ? (
                                <button
                                    type="button"
                                    onClick={() => void loadMoreSection('posts')}
                                    className="mt-2 w-full rounded-[10px] border border-[#2a2a2a] bg-[#0d0d0f] py-2.5 text-[13px] font-bold text-[#E5E7EB]"
                                >
                                    {sectionLoadingMore.posts ? 'Loading…' : 'Load more posts'}
                                </button>
                            ) : null}
                        </div>
                    ) : null}

                    {filteredUsers.length === 0 && filteredLocations.length === 0 && filteredPosts.length === 0 ? (
                        <p className="mt-10 px-4 text-center text-base text-[#6B7280]">No results found</p>
                    ) : null}
                </div>
            ) : (
                <div className="flex flex-col gap-3.5 px-4 pb-7">
                    <div className="rounded-3xl border border-[#181818] bg-[#050505] px-3 pb-3.5 pt-3">
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-[11px] font-bold uppercase tracking-[1.6px] text-[#9CA3AF]">Saved searches</p>
                            {savedSearches.length > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSavedSearches([]);
                                        writeSearchList(SAVED_SEARCHES_KEY, []);
                                    }}
                                    className="text-[11px] font-semibold text-[#6B7280]"
                                >
                                    Clear
                                </button>
                            ) : null}
                        </div>
                        {savedSearches.length === 0 ? (
                            <p className="text-xs text-[#6B7280]">No saved searches yet.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {savedSearches.map((item) => (
                                    <button
                                        key={`saved-${item.mode}-${item.q}-${item.ts}`}
                                        type="button"
                                        onClick={() => {
                                            setSearchMode(item.mode);
                                            setSearchQuery(item.q);
                                        }}
                                        className="max-w-full rounded-full border border-white/15 bg-black/60 px-3.5 py-2 text-xs font-medium text-[#F3F4F6]"
                                    >
                                        {item.q}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="my-3.5 h-px bg-[#181818]" />
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-[11px] font-bold uppercase tracking-[1.6px] text-[#9CA3AF]">Recent searches</p>
                            {recentSearches.length > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRecentSearches([]);
                                        writeSearchList(RECENT_SEARCHES_KEY, []);
                                    }}
                                    className="text-[11px] font-semibold text-[#6B7280]"
                                >
                                    Clear
                                </button>
                            ) : null}
                        </div>
                        {recentSearches.length === 0 ? (
                            <p className="text-xs text-[#6B7280]">Start searching to build recents.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {recentSearches.map((item) => (
                                    <button
                                        key={`recent-${item.mode}-${item.q}-${item.ts}`}
                                        type="button"
                                        onClick={() => {
                                            setSearchMode(item.mode);
                                            setSearchQuery(item.q);
                                        }}
                                        className="max-w-full rounded-full border border-[#2a2a2a] bg-[#101010] px-3.5 py-2 text-xs font-medium text-[#F3F4F6]"
                                    >
                                        {item.q}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {searchMode === 'locations' ? (
                        <>
                            <div className="flex items-center justify-between px-0.5">
                                <p className="text-[11px] font-bold uppercase tracking-[1.6px] text-[#9CA3AF]">Quick picks</p>
                                <p className="text-[11px] text-[#6B7280]">Tap to jump feed.</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {QUICK_PICK_CITIES.map((name) => (
                                    <button
                                        key={name}
                                        type="button"
                                        onClick={() => goToLocation(name, 'location')}
                                        className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2.5 text-left"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.05]">
                                                <IoLocation size={12} color="#10B981" />
                                            </span>
                                            <span className="truncate text-xs font-semibold text-white">{name}</span>
                                        </span>
                                        <span className="mt-1.5 block text-[10px] text-[#6B7280]">Live news near here</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : null}

                    {searchMode === 'venues' ? (
                        <>
                            <div className="flex items-center justify-between px-0.5">
                                <p className="text-[11px] font-bold uppercase tracking-[1.6px] text-[#9CA3AF]">Popular venues</p>
                                <p className="text-[11px] text-[#6B7280]">Tap to open venue feed</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {POPULAR_VENUES.map((name) => (
                                    <button
                                        key={name}
                                        type="button"
                                        onClick={() => goToLocation(name, 'venue')}
                                        className="rounded-2xl border border-white/25 bg-black px-3 py-2.5 text-left"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <IoBusinessOutline size={14} className="shrink-0 text-white" />
                                            <span className="truncate text-xs font-semibold text-white">{name}</span>
                                        </span>
                                        <span className="mt-1.5 block text-[10px] text-[#6B7280]">Popular venue</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : null}

                    {searchMode === 'landmarks' ? (
                        <>
                            <div className="flex items-center justify-between px-0.5">
                                <p className="text-[11px] font-bold uppercase tracking-[1.6px] text-[#9CA3AF]">Popular landmarks</p>
                                <p className="text-[11px] text-[#6B7280]">Tap to open landmark feed</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {POPULAR_LANDMARKS.map((name) => (
                                    <button
                                        key={name}
                                        type="button"
                                        onClick={() => goToLocation(name, 'landmark')}
                                        className="rounded-2xl border border-white/25 bg-black px-3 py-2.5 text-left"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <IoFlagOutline size={14} className="shrink-0 text-white" />
                                            <span className="truncate text-xs font-semibold text-white">{name}</span>
                                        </span>
                                        <span className="mt-1.5 block text-[10px] text-[#6B7280]">Popular landmark</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : null}

                    {searchMode === 'users' ? (
                        <div className="flex flex-col gap-2.5 rounded-3xl border border-[#181818] bg-[#050505] p-3">
                            <p className="text-[11px] font-bold uppercase tracking-[1.6px] text-[#9CA3AF]">Suggested users</p>
                            {suggestedUsers.length === 0 ? (
                                <p className="text-xs text-[#6B7280]">No suggestions yet.</p>
                            ) : (
                                suggestedUsers.map((u) => (
                                    <div key={u.handle} className="flex items-center justify-between gap-2">
                                        <button type="button" onClick={() => goToUser(u.handle)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                                            <Avatar src={avatarSrc(u.avatar_url)} name={(u.handle || 'User').split('@')[0]} size={36} />
                                            <span className="min-w-0">
                                                <span className="block truncate text-[15px] font-semibold text-white">{u.handle}</span>
                                                <span className="mt-0.5 block truncate text-[13px] text-[#9CA3AF]">{u.display_name || 'User'}</span>
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            disabled={followBusyHandle === u.handle}
                                            onClick={() => void onToggleFollowSuggested(u.handle)}
                                            className={`min-w-[86px] rounded-full px-3 py-[7px] text-xs font-bold text-white ${
                                                localFollowState[u.handle] || localRequestState[u.handle] ? 'bg-[#374151]' : 'bg-[#2563EB]'
                                            }`}
                                        >
                                            {followBusyHandle === u.handle
                                                ? '…'
                                                : localFollowState[u.handle]
                                                  ? 'Following'
                                                  : localRequestState[u.handle]
                                                    ? 'Requested'
                                                    : 'Follow'}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : null}
                </div>
            )}

            {scopePicker ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="search-scope-title">
                    <button type="button" aria-label="Close" className="absolute inset-0 bg-black/72" onClick={() => setScopePicker(null)} />
                    <div
                        className="relative w-full max-w-[400px] overflow-hidden rounded-2xl border border-white/10"
                        style={{
                            backgroundColor: '#03091B',
                            backgroundImage: 'linear-gradient(160deg, #03091B 0%, #071330 42%, #160830 78%, #0A051C 100%)',
                        }}
                    >
                        <div className="p-5">
                            <h2 id="search-scope-title" className="text-lg font-semibold text-white">Which feed?</h2>
                            <p className="mt-1 text-sm text-[#D1E4FF]">{scopePicker.name}</p>
                            <p className="mt-2 text-xs leading-[17px] text-[#94A3B8]">
                                Country is the whole nation. City is the metro area. Local area is the nearest neighbourhood when available.
                            </p>
                            <div className="mt-4 flex flex-col gap-2">
                                {parsedPlaceFeedFromSuggestion(scopePicker).options.map((opt) => (
                                    <button
                                        key={opt.scope}
                                        type="button"
                                        onClick={() => {
                                            openFeedSelection(resolvePlaceFeedSelection(scopePicker, opt.scope), 'location');
                                            setScopePicker(null);
                                        }}
                                        className="rounded-xl border border-white/10 bg-[rgba(15,36,48,0.55)] px-4 py-3 text-left text-sm font-semibold text-white"
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <button type="button" onClick={() => setScopePicker(null)} className="mt-3 w-full py-2.5 text-sm font-semibold text-[#00F2FF]">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <GazetteerAlertSheet
                visible={alertSheet != null}
                title={alertSheet?.title ?? ''}
                message={alertSheet?.message}
                showIcon
                icon={alertSheet?.title === 'Action failed' || alertSheet?.title === 'Sign in required' ? 'alert' : 'success'}
                confirmButtonText="OK"
                onConfirm={() => setAlertSheet(null)}
                onDismiss={() => setAlertSheet(null)}
            />
        </div>
    );
}

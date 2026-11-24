import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    IoAdd,
    IoArrowForward,
    IoClose,
    IoLocationOutline,
    IoReturnDownForwardOutline,
    IoSparklesOutline,
} from 'react-icons/io5';
import { useAuth } from '../context/Auth';
import { searchLocations, searchLocalGazetteer, type LocationSuggestion } from '../api/locations';
import { rewriteMediaUrlForClient } from '../api/apiBaseUrl';
import Avatar from '../components/Avatar';
import { getPlaceFeedPickerOptions, resolvePlaceFeedSelection, type PlaceFeedSelection } from '../utils/pickPlaceFeedScope';
import { parsedPlaceFeedFromSuggestion } from '../utils/placeFeedLevels';
import { connectSocket, joinLocationFeed, leaveLocationFeed } from '../services/socketio';

const POPULAR = [
    'Dublin', 'Cork', 'London', 'Paris', 'Berlin', 'New York', 'Tokyo', 'Sydney',
];

const ROTATING_CITIES = [
    'Paris', 'London', 'Rome', 'Madrid', 'Berlin', 'Tokyo',
    'Dublin', 'New York', 'Sydney', 'Toronto', 'Singapore', 'Amsterdam',
];
const PLACEHOLDER_ROTATE_MS = 2800;
const AVATAR_RING = 84;
const AVATAR_STROKE = 3;
const AVATAR_RADIUS = (AVATAR_RING - AVATAR_STROKE) / 2;
const AVATAR_CIRCUMFERENCE = 2 * Math.PI * AVATAR_RADIUS;

/** Border grows from the top of the profile photo until the ring is complete. */
function DiscoverAvatarRing({
    settled,
    onSettle,
}: {
    settled: boolean;
    onSettle: () => void;
}) {
    const circleRef = React.useRef<SVGCircleElement>(null);

    React.useEffect(() => {
        const circle = circleRef.current;
        if (!circle) return;
        if (settled) {
            circle.style.strokeDashoffset = '0';
            return;
        }
        const started = performance.now();
        let frame = 0;
        const tick = (now: number) => {
            const t = Math.min(1, (now - started) / 2200);
            const eased = 1 - Math.pow(1 - t, 3);
            circle.style.strokeDashoffset = String(AVATAR_CIRCUMFERENCE * (1 - eased));
            if (t < 1) frame = requestAnimationFrame(tick);
            else onSettle();
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [settled, onSettle]);

    return (
        <svg
            aria-hidden
            width={AVATAR_RING}
            height={AVATAR_RING}
            viewBox={`0 0 ${AVATAR_RING} ${AVATAR_RING}`}
            className="pointer-events-none absolute left-1/2 top-1/2"
            style={{ transform: 'translate(-50%, -50%)' }}
        >
            <circle
                ref={circleRef}
                cx={AVATAR_RING / 2}
                cy={AVATAR_RING / 2}
                r={AVATAR_RADIUS}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={AVATAR_STROKE}
                strokeLinecap="round"
                strokeDasharray={AVATAR_CIRCUMFERENCE}
                strokeDashoffset={settled ? 0 : AVATAR_CIRCUMFERENCE}
                transform={`rotate(-90 ${AVATAR_RING / 2} ${AVATAR_RING / 2})`}
            />
        </svg>
    );
}
const KEYBOARD_OPEN_THRESHOLD_PX = 100;

const CANVAS_STYLE: React.CSSProperties = {
    backgroundColor: '#03091B',
    backgroundImage: 'linear-gradient(160deg, #03091B 0%, #071330 42%, #160830 78%, #0A051C 100%)',
};

export default function DiscoverPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [query, setQuery] = React.useState('');
    const [suggestions, setSuggestions] = React.useState<LocationSuggestion[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(-1);
    const [scopePicker, setScopePicker] = React.useState<LocationSuggestion | null>(null);
    const [hideSuggestions, setHideSuggestions] = React.useState(false);
    const [placeholderCityIndex, setPlaceholderCityIndex] = React.useState(0);
    const [keyboardOpen, setKeyboardOpen] = React.useState(false);
    const [liveDropCount, setLiveDropCount] = React.useState(0);
    const [avatarRingSettled, setAvatarRingSettled] = React.useState(false);
    const settleAvatarRing = React.useCallback(() => setAvatarRingSettled(true), []);
    const [visibleViewport, setVisibleViewport] = React.useState(() => ({
        top: 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 800,
    }));
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    const popularResults = React.useMemo(
        () => POPULAR.filter((name) => name.toLowerCase().includes(query.toLowerCase())),
        [query],
    );

    const hasSearchQuery = query.trim().length > 0;
    const showSuggestionsPanel = query.trim().length >= 2 && !scopePicker && !hideSuggestions;
    const placeholderCity = ROTATING_CITIES[placeholderCityIndex];

    const promptSuggestions = React.useMemo(() => {
        const local = (user?.local || '').trim();
        const third =
            local && !/^paris|new york$/i.test(local)
                ? { city: local, label: `Drop into ${local}` }
                : { city: 'Dublin', label: 'Drop into Dublin' };
        return [
            { city: 'Paris', label: "Let's go to the Paris feed" },
            { city: 'New York', label: "What's happening in New York" },
            third,
        ];
    }, [user?.local]);

    const rawName = user?.name || 'Friend';
    const firstName = rawName.split('@')[0].trim().split(/\s+/)[0];
    const username = (user?.handle || '').replace(/^@/, '').trim() || firstName;
    const avatarName = (user?.handle || user?.name || 'User').split('@')[0];
    const avatarSrc = user?.avatarUrl ? rewriteMediaUrlForClient(user.avatarUrl) : undefined;

    const showApiRows = suggestions.length > 0;
    const showPopularFallback = !loading && suggestions.length === 0 && popularResults.length > 0;
    const showEmpty = !loading && suggestions.length === 0 && popularResults.length === 0;

    React.useEffect(() => {
        if (hasSearchQuery) return;
        const id = window.setInterval(() => {
            setPlaceholderCityIndex((i) => (i + 1) % ROTATING_CITIES.length);
        }, PLACEHOLDER_ROTATE_MS);
        return () => window.clearInterval(id);
    }, [hasSearchQuery]);

    React.useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const syncViewport = () => {
            const gap = window.innerHeight - vv.height;
            setKeyboardOpen(gap > KEYBOARD_OPEN_THRESHOLD_PX);
            setVisibleViewport({ top: vv.offsetTop, height: vv.height });
        };
        syncViewport();
        vv.addEventListener('resize', syncViewport);
        vv.addEventListener('scroll', syncViewport);
        window.addEventListener('resize', syncViewport);
        return () => {
            vv.removeEventListener('resize', syncViewport);
            vv.removeEventListener('scroll', syncViewport);
            window.removeEventListener('resize', syncViewport);
        };
    }, []);

    React.useEffect(() => {
        if (!scopePicker) return;
        searchInputRef.current?.blur();
    }, [scopePicker]);

    React.useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setSuggestions([]);
            setLoading(false);
            return;
        }
        setSuggestions(searchLocalGazetteer(q, 20, 'all'));
        const ctrl = new AbortController();
        const id = window.setTimeout(async () => {
            try {
                setLoading(true);
                const res = await searchLocations(q, 20, 'all', ctrl.signal);
                if (!ctrl.signal.aborted) setSuggestions(res);
            } catch (e) {
                if (!ctrl.signal.aborted && (e as Error)?.name !== 'AbortError') {
                    setSuggestions(searchLocalGazetteer(q, 20, 'all'));
                }
            } finally {
                if (!ctrl.signal.aborted) setLoading(false);
            }
        }, 120);
        return () => {
            window.clearTimeout(id);
            ctrl.abort();
        };
    }, [query]);

    React.useEffect(() => {
        if (!user?.handle) return;
        const rooms = [user.local, user.regional, user.national]
            .map((loc) => (typeof loc === 'string' ? loc.trim() : ''))
            .filter((loc, i, all) => loc.length > 0 && all.indexOf(loc) === i)
            .map((location) => ({ location }));
        if (rooms.length === 0) return;
        const socket = connectSocket(user.handle);
        rooms.forEach((room) => joinLocationFeed(room));
        const seen = new Set<string>();
        const onNewFeedPost = (data: { post?: { id?: string } }) => {
            const id = data?.post?.id;
            if (!id || seen.has(String(id))) return;
            seen.add(String(id));
            setLiveDropCount((n) => n + 1);
        };
        const onWindowPost = (event: Event) => {
            onNewFeedPost((event as CustomEvent<{ post?: { id?: string } }>).detail || {});
        };
        socket?.on('newFeedPost', onNewFeedPost);
        window.addEventListener('newFeedPost', onWindowPost);
        return () => {
            socket?.off('newFeedPost', onNewFeedPost);
            window.removeEventListener('newFeedPost', onWindowPost);
            rooms.forEach((room) => leaveLocationFeed(room));
        };
    }, [user?.handle, user?.local, user?.regional, user?.national]);

    function applyFeedSelection(selection: PlaceFeedSelection) {
        try {
            sessionStorage.setItem('pendingLocation', selection.filter);
            sessionStorage.setItem('pendingLocationLabel', selection.label);
            sessionStorage.setItem('pendingLocationScope', selection.scope);
            if (selection.placeId) {
                sessionStorage.setItem('pendingLocationPlaceId', selection.placeId);
            } else {
                sessionStorage.removeItem('pendingLocationPlaceId');
            }
            window.dispatchEvent(
                new CustomEvent('locationChange', {
                    detail: {
                        location: selection.filter,
                        locationLabel: selection.label,
                        locationScope: selection.scope,
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
        if (selection.placeId) params.set('place_id', selection.placeId);
        navigate(`/feed?${params.toString()}`);
    }

    function openScopedFeed(scope: 'local' | 'regional' | 'national', place: string) {
        const name = place.trim();
        if (!name) return;
        setLiveDropCount(0);
        try {
            sessionStorage.removeItem('pendingLocation');
            sessionStorage.removeItem('pendingLocationLabel');
            sessionStorage.removeItem('pendingLocationScope');
            sessionStorage.removeItem('pendingLocationPlaceId');
            sessionStorage.removeItem('pendingFilterType');
        } catch {
            /* ignore */
        }
        navigate(`/feed?home=${scope}`);
    }

    const nearbyPlace = (user?.local || 'Finglas').trim();
    const regionalPlace = (user?.regional || '').trim();
    const nationalPlace = (user?.national || '').trim();
    const scopePills = [
        { key: 'nearby', label: 'Nearby', place: nearbyPlace, scope: 'local' as const },
        { key: 'regional', label: regionalPlace || 'Regional', place: regionalPlace, scope: 'regional' as const },
        { key: 'national', label: nationalPlace || 'National', place: nationalPlace, scope: 'national' as const },
    ];

    function dismissSuggestionList() {
        setHideSuggestions(true);
        setActiveIndex(-1);
        searchInputRef.current?.blur();
    }

    function onSuggestionSelected(suggestion: LocationSuggestion) {
        dismissSuggestionList();
        if (getPlaceFeedPickerOptions(suggestion)) {
            setScopePicker(suggestion);
            return;
        }
        applyFeedSelection(resolvePlaceFeedSelection(suggestion));
    }

    function selectPopularCity(name: string) {
        dismissSuggestionList();
        applyFeedSelection(
            resolvePlaceFeedSelection({
                name,
                type: 'location',
                country: name,
                national: name,
                local: name,
                regional: name,
            }),
        );
    }

    function clearSearch() {
        setQuery('');
        setSuggestions([]);
        setActiveIndex(-1);
        setHideSuggestions(false);
        searchInputRef.current?.blur();
    }

    function chooseFromQuery() {
        const trimmed = query.trim();
        if (!trimmed) return;
        if (suggestions.length > 0) {
            const chosen = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
            if (chosen) onSuggestionSelected(chosen);
            return;
        }
        selectPopularCity(trimmed);
    }

    const shellStyle: React.CSSProperties = keyboardOpen
        ? { ...CANVAS_STYLE, marginTop: visibleViewport.top, height: visibleViewport.height }
        : CANVAS_STYLE;

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden" style={shellStyle}>
            <div
                className={`flex min-h-0 flex-1 flex-col px-5 ${keyboardOpen ? 'justify-start' : 'justify-between'}`}
                style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
            >
                <div className="flex min-h-11 shrink-0 items-center gap-2 pt-10">
                    {scopePills.map((pill) => (
                        <button
                            key={pill.key}
                            type="button"
                            onClick={() => openScopedFeed(pill.scope, pill.place)}
                            className="flex min-w-0 flex-1 items-center gap-1 text-left"
                            aria-label={`Open ${pill.label} feed`}
                        >
                            <IoReturnDownForwardOutline size={16} className="shrink-0 text-white" />
                            <span className="truncate text-[15px] leading-5 text-[#D1E4FF]">{pill.label}</span>
                        </button>
                    ))}
                </div>

                {keyboardOpen ? (
                    <div className="h-2 shrink-0" />
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center pb-3">
                        <button
                            type="button"
                            onClick={() => navigate('/profile')}
                            className="relative mb-[18px] flex h-[84px] w-[84px] items-center justify-center"
                            aria-label="Open Passport"
                        >
                            <DiscoverAvatarRing settled={avatarRingSettled} onSettle={settleAvatarRing} />
                            <Avatar src={avatarSrc} name={avatarName} handle={user?.handle} size={72} />
                        </button>
                        <p className="text-center text-[28px] font-semibold leading-9 text-white">
                            Let&apos;s go social traveling,
                        </p>
                        <p className="text-center text-[28px] font-semibold leading-9 text-white">{username}</p>
                    </div>
                )}

                <div className="mx-auto w-full max-w-[480px] shrink-0 pb-2">
                    {showSuggestionsPanel ? (
                        <div
                            className={`mb-2.5 overflow-y-auto rounded-2xl border border-white/10 bg-[rgba(8,18,16,0.88)] ${
                                keyboardOpen ? 'max-h-[180px]' : 'max-h-64'
                            }`}
                        >
                            {loading && suggestions.length === 0 && popularResults.length === 0 ? (
                                <p className="px-4 py-3 text-sm text-[#94A3B8]">Searching…</p>
                            ) : null}
                            {showEmpty ? (
                                <p className="px-4 py-3 text-sm text-[#94A3B8]">No places found. Try another spelling.</p>
                            ) : null}
                            {showApiRows
                                ? suggestions.slice(0, 8).map((s, idx) => {
                                      const primary = s.display_name || s.name.split(',')[0];
                                      return (
                                          <button
                                              key={`api-${s.type}-${s.place_id || s.name}-${idx}`}
                                              type="button"
                                              onMouseDown={(e) => e.preventDefault()}
                                              onClick={() => onSuggestionSelected(s)}
                                              className={`flex w-full items-center gap-2.5 border-t border-white/[0.06] px-4 py-3 text-left first:border-t-0 ${
                                                  activeIndex === idx ? 'bg-white/10' : ''
                                              }`}
                                          >
                                              <IoLocationOutline size={16} className="shrink-0 text-white" />
                                              <span className="min-w-0 flex-1">
                                                  <span className="block text-sm font-semibold text-white">{primary}</span>
                                                  <span className="mt-0.5 block text-[11px] text-[#D1E4FF]">{s.name}</span>
                                              </span>
                                          </button>
                                      );
                                  })
                                : null}
                            {showPopularFallback
                                ? popularResults.slice(0, 6).map((name, idx) => (
                                      <button
                                          key={name}
                                          type="button"
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => selectPopularCity(name)}
                                          className={`flex w-full items-center gap-2.5 border-t border-white/[0.06] px-4 py-3 text-left first:border-t-0 ${
                                              activeIndex === idx ? 'bg-white/10' : ''
                                          }`}
                                      >
                                          <IoLocationOutline size={16} className="shrink-0 text-white" />
                                          <span className="text-sm font-semibold text-white">{name}</span>
                                      </button>
                                  ))
                                : null}
                        </div>
                    ) : (
                        <div className="mb-[22px] flex flex-col gap-[22px] px-1">
                            {promptSuggestions.map((item) => (
                                <button
                                    key={item.city}
                                    type="button"
                                    onClick={() => selectPopularCity(item.city)}
                                    className="flex items-center gap-3.5 py-0.5 text-left"
                                    aria-label={item.label}
                                >
                                    <IoReturnDownForwardOutline size={18} className="shrink-0 text-white" />
                                    <span className="text-base font-normal leading-[22px] text-[#D1E4FF]">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {liveDropCount > 0 ? (
                        <button
                            type="button"
                            onClick={() => {
                                setLiveDropCount(0);
                                openScopedFeed('local', nearbyPlace);
                            }}
                            className="mx-auto mb-3 flex items-center gap-1.5 rounded-full bg-[#3D9B8F] px-3.5 py-2 text-[13px] font-bold text-[#04110f]"
                            aria-label={`${liveDropCount} new drops nearby`}
                        >
                            <IoSparklesOutline size={14} />
                            {liveDropCount === 1 ? '1 new drop nearby' : `${liveDropCount} new drops nearby`}
                        </button>
                    ) : null}

                    <div className="flex min-h-[54px] items-center rounded-full border border-white/15 bg-[#2A2A2E] pl-4 pr-2">
                        <IoAdd size={22} className="mr-3.5 shrink-0 text-white" aria-hidden />
                        <span className="mr-2 shrink-0 text-base font-normal text-[#94A3B8]">Discover ·</span>
                        <input
                            ref={searchInputRef}
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setActiveIndex(-1);
                                setHideSuggestions(false);
                            }}
                            onKeyDown={(e) => {
                                const total = Math.min(8, suggestions.length) || Math.min(6, popularResults.length);
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    if (total > 0) setActiveIndex((i) => (i + 1) % total);
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    if (total > 0) setActiveIndex((i) => (i - 1 + total) % total);
                                } else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    chooseFromQuery();
                                }
                            }}
                            placeholder={hasSearchQuery ? '' : placeholderCity}
                            aria-label="Discover locations"
                            autoCorrect="off"
                            autoCapitalize="none"
                            className="mr-1.5 min-w-0 flex-1 bg-transparent py-3 text-base font-semibold text-white placeholder:font-normal placeholder:text-[#94A3B8] focus:outline-none"
                        />
                        {hasSearchQuery ? (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="mr-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-[#94A3B8]"
                                aria-label="Clear search"
                            >
                                <IoClose size={16} />
                            </button>
                        ) : null}
                        {loading ? (
                            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-[#00F2FF] border-t-transparent" aria-hidden />
                        ) : null}
                        <button
                            type="button"
                            onClick={chooseFromQuery}
                            className="ml-1.5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#04110f]"
                            aria-label="Search places"
                        >
                            <IoArrowForward size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {scopePicker ? (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="discover-scope-picker-title"
                >
                    <button type="button" aria-label="Close" className="absolute inset-0 bg-black/72" onClick={() => {
                        setHideSuggestions(false);
                        setScopePicker(null);
                    }} />
                    <div
                        className="relative w-full max-w-[400px] overflow-hidden rounded-2xl border border-white/10"
                        style={CANVAS_STYLE}
                    >
                        <div className="relative z-[1] p-5">
                            <h2 id="discover-scope-picker-title" className="text-lg font-semibold text-white">
                                Which feed?
                            </h2>
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
                                            applyFeedSelection(resolvePlaceFeedSelection(scopePicker, opt.scope));
                                            setScopePicker(null);
                                        }}
                                        className="rounded-xl border border-white/10 bg-[rgba(15,36,48,0.55)] px-4 py-3 text-left text-sm font-semibold text-white"
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setHideSuggestions(false);
                                    setScopePicker(null);
                                }}
                                className="mt-3 w-full py-2.5 text-sm font-semibold text-[#00F2FF]"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

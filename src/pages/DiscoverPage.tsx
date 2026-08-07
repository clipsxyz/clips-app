import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMapPin, FiSearch, FiX } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import { searchLocations, type LocationSuggestion } from '../api/locations';
import DiscoverAmbientCanvas from '../components/DiscoverAmbientCanvas';
import { AnimatePresence, motion } from 'framer-motion';
import { getPlaceFeedPickerOptions, resolvePlaceFeedSelection, type PlaceFeedSelection } from '../utils/pickPlaceFeedScope';
import { parsedPlaceFeedFromSuggestion } from '../utils/placeFeedLevels';

/** Visual viewport shrinks by roughly this much when the mobile keyboard is open. */
const KEYBOARD_OPEN_THRESHOLD_PX = 100;

const ROTATING_CITIES = [
    'Paris', 'London', 'Rome', 'Madrid', 'Berlin', 'Tokyo',
    'Dublin', 'New York', 'Sydney', 'Toronto', 'Singapore', 'Amsterdam',
];

const PLACEHOLDER_ROTATE_MS = 2800;

export default function DiscoverPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [query, setQuery] = React.useState('');
    const [suggestions, setSuggestions] = React.useState<LocationSuggestion[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState<number>(-1);
    const [scopePicker, setScopePicker] = React.useState<LocationSuggestion | null>(null);
    const [keyboardOpen, setKeyboardOpen] = React.useState(false);
    const [placeholderCityIndex, setPlaceholderCityIndex] = React.useState(0);
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    const hasSearchQuery = query.trim().length > 0;
    const showSuggestionsPanel = query.trim().length >= 2 && !scopePicker;
    /** Keep carousel until user types 2+ chars (when suggestions panel opens). */
    const showPlaceholderCarousel = !showSuggestionsPanel;

    const [visibleViewport, setVisibleViewport] = React.useState(() => ({
        top: 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 800,
    }));

    /** Compact greeting + suggestions only while user is actively searching. */
    const keyboardLayout = keyboardOpen && hasSearchQuery;

    function clearSearch() {
        setQuery('');
        setSuggestions([]);
        setActiveIndex(-1);
        searchInputRef.current?.blur();
    }

    React.useEffect(() => {
        if (!showPlaceholderCarousel) return;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) return;

        const id = window.setInterval(() => {
            setPlaceholderCityIndex((i) => (i + 1) % ROTATING_CITIES.length);
        }, PLACEHOLDER_ROTATE_MS);
        return () => window.clearInterval(id);
    }, [showPlaceholderCarousel]);

    React.useEffect(() => {
        if (!scopePicker) return;
        searchInputRef.current?.blur();
    }, [scopePicker]);

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

    const popular: { name: string }[] = [
        { name: 'Dublin' }, { name: 'Cork' }, { name: 'London' }, { name: 'Paris' },
        { name: 'Berlin' }, { name: 'New York' }, { name: 'Tokyo' }, { name: 'Sydney' },
    ];

    const results = popular.filter(l => l.name.toLowerCase().includes(query.toLowerCase()));

    React.useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setSuggestions([]);
            setLoading(false);
            return;
        }
        const ctrl = new AbortController();
        const id = setTimeout(async () => {
            try {
                setLoading(true);
                const res = await searchLocations(q, 20, 'all', ctrl.signal);
                if (!ctrl.signal.aborted) setSuggestions(res);
            } catch (e) {
                if (!ctrl.signal.aborted && (e as Error)?.name !== 'AbortError') setSuggestions([]);
            } finally {
                if (!ctrl.signal.aborted) setLoading(false);
            }
        }, 200);
        return () => { clearTimeout(id); ctrl.abort(); };
    }, [query]);

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
                })
            );
        } catch { /* ignore */ }
        const params = new URLSearchParams({
            location: selection.filter,
            label: selection.label,
            scope: selection.scope,
        });
        if (selection.placeId) params.set('place_id', selection.placeId);
        navigate(`/feed?${params.toString()}`);
    }

    function onSuggestionSelected(suggestion: LocationSuggestion) {
        if (getPlaceFeedPickerOptions(suggestion)) {
            setScopePicker(suggestion);
            return;
        }
        applyFeedSelection(resolvePlaceFeedSelection(suggestion));
    }

    function selectPopularCity(name: string) {
        applyFeedSelection(
            resolvePlaceFeedSelection({ name, type: 'location', country: name, national: name, local: name, regional: name })
        );
    }

    const rawName = user?.name || 'Friend';
    const firstName = rawName.split('@')[0].trim().split(/\s+/)[0];

    const suggestionList = query.trim().length >= 2 ? (
        <ul className="divide-y divide-white/5">
            {loading && suggestions.length === 0 && results.length === 0 && (
                <li className="px-4 py-3 text-sm text-gray-400">Searching…</li>
            )}
            {!loading && suggestions.length === 0 && results.length === 0 && (
                <li className="px-4 py-3 text-sm text-gray-400">No places found. Try another spelling.</li>
            )}
            {suggestions.slice(0, 8).map((s, idx) => (
                <li key={`${s.type}-${s.name}`}>
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onSuggestionSelected(s)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left ${activeIndex === idx ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    >
                        <FiMapPin className="h-4 w-4 text-pink-400" />
                        <div className="flex flex-col">
                            <span className="text-sm text-gray-100">{s.display_name || s.name.split(',')[0]}</span>
                            <span className="text-[11px] text-gray-500">{s.name}</span>
                        </div>
                    </button>
                </li>
            ))}
            {suggestions.length === 0 && !loading && results.slice(0, 6).map((loc, idx) => (
                <li key={loc.name}>
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectPopularCity(loc.name)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left ${activeIndex === idx ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    >
                        <FiMapPin className="h-4 w-4 text-pink-400" />
                        <span className="text-sm text-gray-100">{loc.name}</span>
                    </button>
                </li>
            ))}
        </ul>
    ) : null;

    const panelStyle: React.CSSProperties = keyboardOpen
        ? { top: visibleViewport.top, height: visibleViewport.height }
        : { top: 0, height: '100%' };

    const scopePickerOverlayStyle: React.CSSProperties = {
        top: visibleViewport.top,
        left: 0,
        right: 0,
        height: visibleViewport.height,
        bottom: 'auto',
    };

    return (
        <div className="relative h-[calc(100dvh-2.75rem)] overflow-hidden bg-[#0b0711]">
            <DiscoverAmbientCanvas lockViewport={keyboardOpen} />

            {/* Single shell — search input never unmounts, so focus/keyboard work on first tap */}
            <div
                className="fixed left-0 right-0 z-10 flex flex-col px-4"
                style={panelStyle}
            >
                <div
                    className={
                        keyboardLayout
                            ? 'shrink-0 pt-3 pb-2'
                            : 'flex flex-1 flex-col items-center justify-center'
                    }
                >
                    <div className="text-center">
                        <h1 className={keyboardLayout ? 'discover-greeting discover-greeting-compact' : 'discover-greeting'}>
                            {keyboardLayout ? (
                                `Hi ${firstName},`
                            ) : (
                                <>
                                    {`Hi ${firstName},`}
                                    <br />
                                    let&apos;s go social traveling
                                </>
                            )}
                        </h1>
                        <p className={`discover-greeting-sub flex items-center justify-center gap-2 ${keyboardLayout ? 'mt-1 text-xs' : 'mt-3'}`}>
                            Where to for your news?
                            <FiMapPin className="h-4 w-4 opacity-80" aria-hidden />
                        </p>
                    </div>
                </div>

                <div className="mt-auto w-full max-w-md mx-auto shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                    <div className="relative">
                        {showSuggestionsPanel && keyboardLayout && (
                            <div className="mb-2 max-h-[min(28vh,10rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#1a1524]/95 shadow-xl backdrop-blur-md">
                                {suggestionList}
                            </div>
                        )}
                        {showSuggestionsPanel && !keyboardLayout && (
                            <div className="absolute bottom-full left-0 right-0 z-10 mb-2 max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-[#1a1524]/95 shadow-xl backdrop-blur-md">
                                {suggestionList}
                            </div>
                        )}
                        <div className="relative rounded-full discover-search-pill">
                        <FiSearch className="absolute left-4 top-1/2 z-[1] h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
                        <input
                            ref={searchInputRef}
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const total = Math.min(8, suggestions.length) || Math.min(6, results.length);
                                    if (total > 0) setActiveIndex(i => (i + 1) % total);
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const total = Math.min(8, suggestions.length) || Math.min(6, results.length);
                                    if (total > 0) setActiveIndex(i => (i - 1 + total) % total);
                                } else if (e.key === 'Enter') {
                                    if (suggestions.length > 0) {
                                        const chosen = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
                                        if (chosen) onSuggestionSelected(chosen);
                                    } else if (query.trim()) {
                                        selectPopularCity(query.trim());
                                    }
                                }
                            }}
                            placeholder=""
                            aria-label="Discover locations"
                            className={`w-full rounded-full border-0 bg-transparent py-3.5 pl-12 text-[15px] text-gray-100 focus:outline-none focus:ring-0 ${hasSearchQuery ? 'pr-10' : 'pr-4'}`}
                        />
                        {hasSearchQuery && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="absolute right-3 top-1/2 z-[3] -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                                aria-label="Clear search"
                            >
                                <FiX className="h-4 w-4" aria-hidden />
                            </button>
                        )}
                        {showPlaceholderCarousel && (
                            <div
                                className="discover-placeholder-carousel pointer-events-none absolute left-12 right-4 top-1/2 z-10 -translate-y-1/2 select-none"
                                aria-hidden
                            >
                                <span className="discover-placeholder-carousel__prefix">Discover</span>
                                <span className="discover-placeholder-carousel__dot" aria-hidden>·</span>
                                <span className="discover-placeholder-carousel__city">
                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.span
                                            key={ROTATING_CITIES[placeholderCityIndex]}
                                            className="discover-placeholder-carousel__city-inner"
                                            initial={{ opacity: 0, y: 14 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -14 }}
                                            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                                        >
                                            {ROTATING_CITIES[placeholderCityIndex]}
                                        </motion.span>
                                    </AnimatePresence>
                                </span>
                            </div>
                        )}
                        </div>
                    </div>
                </div>
            </div>

            {scopePicker && (
                <div
                    className="fixed z-[60] flex items-center justify-center overflow-y-auto bg-black/70 p-4"
                    style={scopePickerOverlayStyle}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="discover-scope-picker-title"
                    onClick={() => setScopePicker(null)}
                >
                    <motion.div
                        className="relative my-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#060d16] p-5 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <DiscoverAmbientCanvas fixed={false} variant="passport" />
                        <div className="relative z-10">
                        <h2 id="discover-scope-picker-title" className="text-lg font-semibold text-white">
                            Which feed?
                        </h2>
                        <p className="mt-1 text-sm text-white/60">{scopePicker.name}</p>
                        <p className="mt-2 text-xs text-white/45">
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
                                    className="rounded-xl border border-white/10 bg-[rgba(15,36,48,0.55)] px-4 py-3 text-left text-sm font-medium text-gray-100 hover:bg-white/10"
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setScopePicker(null)}
                            className="mt-3 w-full rounded-xl py-2.5 text-sm text-[#3d9b8f] hover:text-[#9fd4cb]"
                        >
                            Cancel
                        </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

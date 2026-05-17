import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMapPin, FiSearch } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import { searchLocations, type LocationSuggestion } from '../api/locations';
import DiscoverAmbientCanvas from '../components/DiscoverAmbientCanvas';
import { motion } from 'framer-motion';
import { getPlaceFeedPickerOptions, resolvePlaceFeedSelection, type PlaceFeedSelection } from '../utils/pickPlaceFeedScope';
import { parsedPlaceFeedFromSuggestion } from '../utils/placeFeedLevels';

export default function DiscoverPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [query, setQuery] = React.useState('');
    const [suggestions, setSuggestions] = React.useState<LocationSuggestion[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState<number>(-1);
    const [scopePicker, setScopePicker] = React.useState<LocationSuggestion | null>(null);

    const popular: { name: string; flag?: string; posts?: number }[] = [
        // Ireland (counties + cities)
        { name: 'Dublin' }, { name: 'Cork' }, { name: 'Galway' }, { name: 'Limerick' }, { name: 'Waterford' }, { name: 'Kilkenny' }, { name: 'Wexford' }, { name: 'Kildare' }, { name: 'Meath' }, { name: 'Wicklow' },
        // UK
        { name: 'London' }, { name: 'Manchester' }, { name: 'Birmingham' }, { name: 'Leeds' }, { name: 'Glasgow' }, { name: 'Edinburgh' }, { name: 'Cardiff' }, { name: 'Bristol' },
        // Europe capitals
        { name: 'Paris' }, { name: 'Rome' }, { name: 'Madrid' }, { name: 'Berlin' }, { name: 'Amsterdam' }, { name: 'Brussels' }, { name: 'Lisbon' }, { name: 'Vienna' }, { name: 'Prague' }, { name: 'Budapest' }, { name: 'Copenhagen' }, { name: 'Stockholm' }, { name: 'Oslo' }, { name: 'Helsinki' }, { name: 'Zurich' },
        // North America
        { name: 'New York' }, { name: 'Los Angeles' }, { name: 'Chicago' }, { name: 'Toronto' }, { name: 'Vancouver' }, { name: 'Mexico City' },
        // Asia-Pacific
        { name: 'Tokyo' }, { name: 'Seoul' }, { name: 'Beijing' }, { name: 'Shanghai' }, { name: 'Hong Kong' }, { name: 'Singapore' }, { name: 'Sydney' }, { name: 'Melbourne' }, { name: 'Auckland' }
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
            window.dispatchEvent(
                new CustomEvent('locationChange', {
                    detail: {
                        location: selection.filter,
                        locationLabel: selection.label,
                        locationScope: selection.scope,
                    },
                })
            );
        } catch { /* ignore */ }
        const params = new URLSearchParams({
            location: selection.filter,
            label: selection.label,
            scope: selection.scope,
        });
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

    const cityPillColors = [
        'text-pink-400',
        'text-blue-400',
        'text-purple-400',
        'text-red-400',
        'text-amber-400',
        'text-green-400',
        'text-cyan-400',
        'text-orange-400',
        'text-indigo-400',
        'text-emerald-400',
        'text-violet-400',
        'text-rose-400',
    ];

    return (
        <div className="relative min-h-[calc(100dvh-2.75rem)] overflow-hidden bg-[#0b0711]">
            <DiscoverAmbientCanvas />

            <div className="relative z-10 flex min-h-[calc(100dvh-2.75rem)] flex-col items-center justify-center px-4 pb-32 pt-6">
                <div className="flex w-full max-w-md flex-col items-center gap-8">
                    <div className="grid w-full grid-cols-3 gap-2 sm:gap-3">
                        {['Paris', 'London', 'Rome', 'Madrid', 'Berlin', 'Tokyo', 'Dublin', 'New York', 'Sydney', 'Toronto', 'Singapore', 'Amsterdam'].map((city, index) => (
                            <button
                                key={city}
                                type="button"
                                onClick={() => selectPopularCity(city)}
                                className="discover-city-pill flex items-center justify-center gap-1 rounded-full px-2 py-2 text-xs transition-colors sm:gap-2 sm:px-5 sm:text-sm"
                            >
                                <FiMapPin className={`h-3 w-3 shrink-0 sm:h-4 sm:w-4 ${cityPillColors[index % cityPillColors.length]}`} />
                                <span className="truncate">{city}</span>
                            </button>
                        ))}
                    </div>

                    <div className="text-center">
                        <h1 className="discover-greeting">
                            {`Hi ${firstName},`}
                            <br />
                            let&apos;s go social traveling
                        </h1>
                        <p className="discover-greeting-sub mt-3 flex items-center justify-center gap-2">
                            Where to for your news?
                            <FiMapPin className="h-4 w-4 opacity-80" aria-hidden />
                        </p>
                    </div>
                </div>
            </div>

            <div className="fixed bottom-6 left-4 right-4 z-50 mx-auto max-w-md">
                <motion.div layout className="relative rounded-full discover-search-pill">
                    {query.trim().length >= 2 && (
                        <motion.div layout className="absolute bottom-full left-0 right-0 z-10 mb-2 max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-[#1a1524]/95 shadow-xl backdrop-blur-md">
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
                                            onClick={() => selectPopularCity(loc.name)}
                                            className={`flex w-full items-center gap-3 px-4 py-3 text-left ${activeIndex === idx ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                        >
                                            <FiMapPin className="h-4 w-4 text-pink-400" />
                                            <span className="text-sm text-gray-100">{loc.name}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    )}
                    <FiSearch className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
                    <input
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
                        placeholder="Discover other locations..."
                        className="w-full rounded-full border-0 bg-transparent py-3.5 pl-12 pr-4 text-[15px] text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-0"
                    />
                </motion.div>
            </div>

            {scopePicker && (
                <motion.div layout className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1524] p-5 shadow-2xl">
                        <h2 className="text-lg font-semibold text-white">Which feed?</h2>
                        <p className="mt-1 text-sm text-gray-400">{scopePicker.name}</p>
                        <p className="mt-2 text-xs text-gray-500">
                            Pick local, regional, or national — same as your home feed tabs.
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
                                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-gray-100 hover:bg-white/10"
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setScopePicker(null)}
                            className="mt-3 w-full rounded-xl py-2.5 text-sm text-gray-400 hover:text-white"
                        >
                            Cancel
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

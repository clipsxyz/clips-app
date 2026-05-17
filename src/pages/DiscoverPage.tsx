import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMapPin, FiSearch } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import { searchLocations, type LocationSuggestion } from '../api/locations';
import DiscoverAmbientCanvas from '../components/DiscoverAmbientCanvas';

export default function DiscoverPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [query, setQuery] = React.useState('');
    const [suggestions, setSuggestions] = React.useState<LocationSuggestion[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState<number>(-1);

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
        if (!query.trim()) { setSuggestions([]); return; }
        const ctrl = new AbortController();
        const id = setTimeout(async () => {
            try {
                setLoading(true);
                const res = await searchLocations(query.trim(), 20);
                if (!ctrl.signal.aborted) setSuggestions(res);
            } catch (e) {
                if (!ctrl.signal.aborted) setSuggestions([]);
            } finally {
                if (!ctrl.signal.aborted) setLoading(false);
            }
        }, 200);
        return () => { clearTimeout(id); ctrl.abort(); };
    }, [query]);

    function selectLocation(name: string) {
        console.log('Discover: Selecting location:', name);
        try {
            sessionStorage.setItem('pendingLocation', name);
            window.dispatchEvent(new CustomEvent('locationChange', { detail: { location: name } }));
        } catch { }
        navigate(`/feed?location=${encodeURIComponent(name)}`);
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
                                onClick={() => selectLocation(city)}
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
                <div className="relative rounded-full discover-search-pill">
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
                                const list = suggestions.length > 0 ? suggestions.slice(0, 8) : results.slice(0, 6).map(r => ({ name: r.name, type: 'city' as const }));
                                const chosen = activeIndex >= 0 && list[activeIndex] ? list[activeIndex].name : query.trim();
                                if (chosen) selectLocation(chosen);
                            }
                        }}
                        placeholder="Discover other locations..."
                        className="w-full rounded-full border-0 bg-transparent py-3.5 pl-12 pr-4 text-[15px] text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-0"
                    />
                    {(query && (suggestions.length > 0 || results.length > 0)) && (
                        <div className="absolute left-0 right-0 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#1a1524]/95 shadow-xl backdrop-blur-md">
                            <ul className="divide-y divide-white/5">
                                {suggestions.slice(0, 8).map((s, idx) => (
                                    <li key={`${s.type}-${s.name}`}>
                                        <button
                                            type="button"
                                            onClick={() => selectLocation(s.name)}
                                            className={`flex w-full items-center gap-3 px-4 py-3 text-left ${activeIndex === idx ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                        >
                                            <FiMapPin className="h-4 w-4 text-pink-400" />
                                            <div className="flex flex-col">
                                                <span className="text-sm text-gray-100">{s.name}</span>
                                                <span className="text-[11px] capitalize text-gray-500">{s.type}{s.country ? ` • ${s.country}` : ''}</span>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                                {suggestions.length === 0 && results.slice(0, 6).map((loc, idx) => (
                                    <li key={loc.name}>
                                        <button
                                            type="button"
                                            onClick={() => selectLocation(loc.name)}
                                            className={`flex w-full items-center gap-3 px-4 py-3 text-left ${activeIndex === idx ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                        >
                                            <FiMapPin className="h-4 w-4 text-pink-400" />
                                            <span className="text-sm text-gray-100">{loc.name}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMapPin, FiSearch } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import { searchLocations, type LocationSuggestion } from '../api/locations';

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

    // Fetch dynamic suggestions from backend
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
        // Prime Feed to pick up the location immediately
        try {
            sessionStorage.setItem('pendingLocation', name);
            // Also broadcast so an already-mounted Feed can react instantly
            window.dispatchEvent(new CustomEvent('locationChange', { detail: { location: name } }));
        } catch { }
        // Navigate to feed with explicit query param so Feed can pick it up synchronously
        navigate(`/feed?location=${encodeURIComponent(name)}`);
    }

    const firstName = (user?.name || 'Friend').split('@')[0];

    return (
        <div className="p-4 space-y-8 min-h-[70vh] flex flex-col items-center justify-center pb-32">
            {/* Capital city preset pills with location icon */}
            <div className="flex flex-col items-center gap-3">
                <div className="flex flex-wrap justify-center gap-3">
                    {['Paris', 'London', 'Rome', 'Madrid', 'Berlin', 'Tokyo', 'Dublin', 'New York', 'Sydney', 'Toronto', 'Singapore', 'Amsterdam'].map((city, index) => {
                        const colors = [
                            'text-pink-500',
                            'text-blue-500',
                            'text-purple-500',
                            'text-red-500',
                            'text-yellow-500',
                            'text-green-500',
                            'text-cyan-500',
                            'text-orange-500',
                            'text-indigo-500',
                            'text-emerald-500',
                            'text-violet-500',
                            'text-rose-500'
                        ];
                        return (
                            <button
                                key={city}
                                onClick={() => selectLocation(city)}
                                className="px-5 py-2 rounded-full bg-gray-900 text-gray-100 hover:bg-gray-800 transition-colors text-sm flex items-center gap-2 shadow-sm"
                            >
                                <FiMapPin className={`w-4 h-4 ${colors[index % colors.length]}`} />
                                <span>{city}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Greeting below the preset pills */}
            <div className="text-center">
                <h1
                    className="text-4xl md:text-5xl font-extrabold tracking-tight text-sky-400"
                    style={{
                        background: 'linear-gradient(90deg, #87ceeb, #ffb6c1, #87cefa, #c084fc, #34d399, #f59e0b, #ef4444, #dc2626, #fca5a5, #60a5fa, #fb7185, #87ceeb)',
                        backgroundSize: '200% 100%',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        animation: 'shimmer 6s linear infinite'
                    }}
                >
                    {`Hello, ${firstName}`}
                </h1>
                <p className="text-sm md:text-base text-gray-400 dark:text-gray-500 mt-2">WHERE TO</p>
            </div>

            {/* Spacer */}
            <div className="h-10" />

            {/* Bottom search input */}
            <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-50">
                <div className="relative rounded-full">
                    {/* Outer glow like Discover icon */}
                    <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500 via-blue-500 to-violet-500 opacity-60 blur-sm animate-pulse"></div>
                    {/* Shimmer sweep */}
                    <div className="pointer-events-none absolute inset-0 rounded-full overflow-hidden">
                        <div
                            className="absolute inset-0 rounded-full"
                            style={{
                                background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent)',
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 3s linear infinite'
                            }}
                        ></div>
                    </div>

                    {/* Actual input */}
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
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
                            className="w-full pl-10 pr-4 py-3 rounded-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-md border border-transparent"
                        />
                        {(query && (suggestions.length > 0 || results.length > 0)) && (
                            <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-white/95 dark:bg-gray-900/95 shadow-xl ring-1 ring-black/5 backdrop-blur-md overflow-hidden">
                                <ul className="divide-y divide-gray-100/60 dark:divide-gray-800/60">
                                    {/* Dynamic suggestions */}
                                    {suggestions.slice(0, 8).map((s, idx) => (
                                        <li key={`${s.type}-${s.name}`}>
                                            <button
                                                onClick={() => selectLocation(s.name)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-left ${activeIndex === idx ? 'bg-gray-100 dark:bg-gray-800/70' : 'hover:bg-gray-50 dark:hover:bg-gray-800/70'}`}
                                            >
                                                <FiMapPin className="w-4 h-4 text-sky-500" />
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-gray-900 dark:text-gray-100">{s.name}</span>
                                                    <span className="text-[11px] text-gray-500 capitalize">{s.type}{s.country ? ` • ${s.country}` : ''}</span>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                    {/* Fallback static if no dynamic */}
                                    {suggestions.length === 0 && results.slice(0, 6).map((loc, idx) => (
                                        <li key={loc.name}>
                                            <button
                                                onClick={() => selectLocation(loc.name)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-left ${activeIndex === idx ? 'bg-gray-100 dark:bg-gray-800/70' : 'hover:bg-gray-50 dark:hover:bg-gray-800/70'}`}
                                            >
                                                <FiMapPin className="w-4 h-4 text-sky-500" />
                                                <span className="text-sm text-gray-900 dark:text-gray-100">{loc.name}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Safe area spacer so fixed input clears any footer */}
            <div className="h-24" />

            {/* Hide bulky on-page results to keep bottom input visible */}
        </div>
    );
}



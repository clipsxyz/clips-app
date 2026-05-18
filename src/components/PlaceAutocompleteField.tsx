import React from 'react';
import { createPortal } from 'react-dom';
import { FiMapPin } from 'react-icons/fi';
import { searchLocations, type LocationSuggestion, type SignupLocationLevel } from '../api/locations';
import {
    feedHeaderLabelFromSuggestion,
    formatFeedLevelsLine,
    parsedPlaceFeedFromSuggestion,
} from '../utils/placeFeedLevels';

export type PlaceFieldMode = 'location' | 'venue' | 'landmark';

function labelForPostField(s: LocationSuggestion, mode: PlaceFieldMode): string {
    const parsed = parsedPlaceFeedFromSuggestion(s);
    if (mode === 'location') {
        return parsed.local || parsed.regional || parsed.national || feedHeaderLabelFromSuggestion(s, parsed);
    }
    return feedHeaderLabelFromSuggestion(s, parsed) || s.display_name || s.name.split(',')[0].trim();
}

type Props = {
    value: string;
    onChange: (value: string) => void;
    mode: PlaceFieldMode;
    placeholder?: string;
    inputClassName?: string;
    wrapperClassName?: string;
    showIcon?: boolean;
    /** Called when user picks a suggestion (in addition to onChange). */
    onSelectSuggestion?: (suggestion: LocationSuggestion) => void;
    signupLevel?: SignupLocationLevel;
    parentCountry?: string;
    parentRegion?: string;
    disabled?: boolean;
    /** Show Local / Regional / National under each suggestion (signup home area). */
    showFeedLevels?: boolean;
};

const MENU_MAX_HEIGHT = 192;
const MENU_GAP = 6;

export default function PlaceAutocompleteField({
    value,
    onChange,
    mode,
    placeholder,
    inputClassName = '',
    wrapperClassName = '',
    showIcon = false,
    onSelectSuggestion,
    signupLevel,
    parentCountry = '',
    parentRegion = '',
    disabled = false,
    showFeedLevels = false,
}: Props) {
    const [suggestions, setSuggestions] = React.useState<LocationSuggestion[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [open, setOpen] = React.useState(false);
    const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({ visibility: 'hidden' });
    const [dropUp, setDropUp] = React.useState(false);
    const wrapRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const menuRef = React.useRef<HTMLUListElement>(null);

    const apiMode = mode === 'venue' ? 'venue' : mode === 'landmark' ? 'landmark' : 'location';

    const updateMenuPosition = React.useCallback(() => {
        const el = inputRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
        const spaceAbove = rect.top - MENU_GAP;
        const shouldDropUp = spaceBelow < 140 && spaceAbove > spaceBelow;
        const maxHeight = Math.min(MENU_MAX_HEIGHT, Math.max(120, shouldDropUp ? spaceAbove : spaceBelow));

        setDropUp(shouldDropUp);
        setMenuStyle({
            position: 'fixed',
            left: rect.left,
            width: rect.width,
            maxHeight,
            zIndex: 11000,
            visibility: 'visible',
            ...(shouldDropUp
                ? { bottom: window.innerHeight - rect.top + MENU_GAP }
                : { top: rect.bottom + MENU_GAP }),
        });
    }, []);

    React.useEffect(() => {
        if (disabled) {
            setSuggestions([]);
            setLoading(false);
            return;
        }
        const q = value.trim();
        const minLen = signupLevel === 'country' ? 2 : 1;
        if (q.length < minLen) {
            setSuggestions([]);
            setLoading(false);
            return;
        }
        if (signupLevel === 'region' && !parentCountry.trim()) {
            setSuggestions([]);
            return;
        }
        if (signupLevel === 'local' && (!parentCountry.trim() || !parentRegion.trim())) {
            setSuggestions([]);
            return;
        }
        const ctrl = new AbortController();
        const id = setTimeout(async () => {
            try {
                setLoading(true);
                const res = await searchLocations(q, 12, apiMode, ctrl.signal, {
                    level: signupLevel,
                    country: parentCountry,
                    region: parentRegion,
                });
                if (!ctrl.signal.aborted) {
                    setSuggestions(res);
                    setOpen(true);
                }
            } catch (e) {
                if (!ctrl.signal.aborted && (e as Error)?.name !== 'AbortError') {
                    setSuggestions([]);
                }
            } finally {
                if (!ctrl.signal.aborted) setLoading(false);
            }
        }, 200);
        return () => {
            clearTimeout(id);
            ctrl.abort();
        };
    }, [value, apiMode, signupLevel, parentCountry, parentRegion, disabled]);

    const showList = open && value.trim().length >= 2;

    React.useLayoutEffect(() => {
        if (!showList) return;
        updateMenuPosition();
        const onReflow = () => updateMenuPosition();
        window.addEventListener('resize', onReflow);
        window.addEventListener('scroll', onReflow, true);
        return () => {
            window.removeEventListener('resize', onReflow);
            window.removeEventListener('scroll', onReflow, true);
        };
    }, [showList, updateMenuPosition, suggestions.length]);

    React.useEffect(() => {
        const onDocDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (wrapRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDocDown);
        return () => document.removeEventListener('mousedown', onDocDown);
    }, []);

    const pick = (s: LocationSuggestion) => {
        const parsed = parsedPlaceFeedFromSuggestion(s);
        const label = showFeedLevels
            ? parsed.fullName || s.name
            : labelForPostField(s, mode);
        onChange(label);
        onSelectSuggestion?.(s);
        setOpen(false);
        setSuggestions([]);
    };

    const menu = showList ? (
        <ul
            ref={menuRef}
            role="listbox"
            style={menuStyle}
            className={`overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/15 dark:bg-[#141418] ${
                dropUp ? 'mb-0' : 'mt-0'
            }`}
        >
            {loading && suggestions.length === 0 && (
                <li className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">Searching…</li>
            )}
            {!loading && suggestions.length === 0 && (
                <li className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">No places found</li>
            )}
            {suggestions.slice(0, 8).map((s, idx) => (
                <li key={`${s.type}-${s.name}-${idx}`} role="option">
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(s)}
                        className="flex w-full flex-col px-3 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-white/5"
                    >
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                            {s.display_name || s.name.split(',')[0]}
                        </span>
                        {showFeedLevels ? (
                            <span className="mt-0.5 text-[11px] leading-snug text-gray-500">
                                {formatFeedLevelsLine(s)}
                            </span>
                        ) : (
                            <span className="truncate text-[11px] text-gray-500">{s.name}</span>
                        )}
                    </button>
                </li>
            ))}
        </ul>
    ) : null;

    return (
        <div ref={wrapRef} className={`relative ${wrapperClassName}`}>
            {showIcon && (
                <FiMapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
            )}
            <input
                ref={inputRef}
                type="text"
                value={value}
                disabled={disabled}
                onChange={(e) => {
                    onChange(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => {
                    const minLen = signupLevel === 'country' ? 2 : 1;
                    if (value.trim().length >= minLen) setOpen(true);
                    requestAnimationFrame(updateMenuPosition);
                }}
                placeholder={placeholder}
                autoComplete="off"
                className={`${inputClassName}${disabled ? ' opacity-50 cursor-not-allowed' : ''}`}
            />
            {typeof document !== 'undefined' && menu ? createPortal(menu, document.body) : null}
        </div>
    );
}

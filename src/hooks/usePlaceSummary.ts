import React from 'react';
import {
    buildClientPlaceSummaryFallback,
    fetchPlaceSummary,
    type PlaceSummary,
} from '../api/placeSummary';

export function usePlaceSummary(
    locationLabel: string,
    placeId?: string | null,
    enabled = true
): { data: PlaceSummary | null; loading: boolean } {
    const [data, setData] = React.useState<PlaceSummary | null>(null);
    const [loading, setLoading] = React.useState(true);
    const loadedKeyRef = React.useRef('');

    React.useEffect(() => {
        if (!enabled) {
            setLoading(false);
            return;
        }

        const trimmed = locationLabel.trim();
        if (!trimmed) {
            setData(null);
            loadedKeyRef.current = '';
            setLoading(false);
            return;
        }

        const key = `${trimmed}|${placeId ?? ''}`;
        const ctrl = new AbortController();
        // Keep the last summary on reopen / refetch so the modal does not flash empty.
        if (loadedKeyRef.current !== key) {
            setLoading(true);
        }

        fetchPlaceSummary(trimmed, placeId, ctrl.signal)
            .then((result) => {
                if (ctrl.signal.aborted) return;
                setData(result ?? buildClientPlaceSummaryFallback(trimmed));
                loadedKeyRef.current = key;
            })
            .catch(() => {
                if (ctrl.signal.aborted) return;
                setData(buildClientPlaceSummaryFallback(trimmed));
                loadedKeyRef.current = key;
            })
            .finally(() => {
                if (!ctrl.signal.aborted) setLoading(false);
            });

        return () => ctrl.abort();
    }, [locationLabel, placeId, enabled]);

    return { data, loading };
}

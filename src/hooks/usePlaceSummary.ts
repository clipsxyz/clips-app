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

    React.useEffect(() => {
        if (!enabled) {
            setLoading(false);
            return;
        }

        const trimmed = locationLabel.trim();
        if (!trimmed) {
            setData(null);
            setLoading(false);
            return;
        }

        const ctrl = new AbortController();
        setLoading(true);
        setData(null);

        fetchPlaceSummary(trimmed, placeId, ctrl.signal)
            .then((result) => {
                if (ctrl.signal.aborted) return;
                setData(result ?? buildClientPlaceSummaryFallback(trimmed));
            })
            .catch(() => {
                if (ctrl.signal.aborted) return;
                setData(buildClientPlaceSummaryFallback(trimmed));
            })
            .finally(() => {
                if (!ctrl.signal.aborted) setLoading(false);
            });

        return () => ctrl.abort();
    }, [locationLabel, placeId, enabled]);

    return { data, loading };
}

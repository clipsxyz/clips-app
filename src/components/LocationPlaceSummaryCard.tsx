import React from 'react';
import LocationPlaceSummaryBody from './LocationPlaceSummaryBody';
import { usePlaceSummary } from '../hooks/usePlaceSummary';

type Props = {
    locationLabel: string;
    placeId?: string | null;
};

export default function LocationPlaceSummaryCard({ locationLabel, placeId }: Props) {
    const { data, loading } = usePlaceSummary(locationLabel, placeId);

    if (!loading && !data?.summary) return null;

    return (
        <div className="max-w-md mx-auto mt-4 rounded-2xl border border-gray-800 bg-gradient-to-b from-black/80 via-black/70 to-black/90 px-5 py-6 shadow-lg text-left">
            <LocationPlaceSummaryBody locationLabel={locationLabel} data={data} loading={loading} />
        </div>
    );
}

import React from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import LocationPlaceSummaryBody from './LocationPlaceSummaryBody';
import { usePlaceSummary } from '../hooks/usePlaceSummary';

type Props = {
    open: boolean;
    onClose: () => void;
    locationLabel: string;
    placeId?: string | null;
};

export default function LocationPlaceSummaryModal({ open, onClose, locationLabel, placeId }: Props) {
    const { data, loading } = usePlaceSummary(locationLabel, placeId, open);

    React.useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open || typeof document === 'undefined') return null;

    const titleName = locationLabel.split(',')[0]?.trim() || locationLabel;

    return createPortal(
        <div
            className="fixed inset-0 z-[12000] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-8 sm:pb-4"
            role="presentation"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="place-summary-title"
                className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-800 bg-gradient-to-b from-black/95 via-black/90 to-black/95 px-5 py-6 shadow-2xl text-left"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-3 top-3 rounded-full p-1.5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Close"
                >
                    <FiX className="h-5 w-5" />
                </button>
                <p id="place-summary-title" className="sr-only">
                    {`About ${titleName}`}
                </p>
                <LocationPlaceSummaryBody locationLabel={locationLabel} data={data} loading={loading} />
            </div>
        </div>,
        document.body
    );
}

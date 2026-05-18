import type { PlaceSummary } from '../api/placeSummary';

type Props = {
    locationLabel: string;
    data: PlaceSummary | null;
    loading: boolean;
};

export default function LocationPlaceSummaryBody({ locationLabel, data, loading }: Props) {
    const titleName = data?.name || locationLabel.split(',')[0]?.trim() || locationLabel;

    return (
        <>
            <div className="mb-3 text-sm font-medium uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400">
                Discover
            </div>
            <div className="text-lg font-semibold mb-2 text-white">{`About ${titleName}`}</div>
            {loading ? (
                <div className="space-y-2" aria-hidden>
                    <div className="h-3 w-full rounded bg-white/10 animate-pulse" />
                    <div className="h-3 w-[92%] rounded bg-white/10 animate-pulse" />
                    <div className="h-3 w-4/5 rounded bg-white/10 animate-pulse" />
                </div>
            ) : (
                <>
                    {data?.tagline ? <p className="text-xs text-gray-500 mb-2">{data.tagline}</p> : null}
                    <p className="text-sm text-gray-400 leading-relaxed">{data?.summary}</p>
                    {data?.facts && data.facts.length > 0 ? (
                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-4">
                            {data.facts.map((fact) => (
                                <div key={fact.label}>
                                    <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                        {fact.label}
                                    </dt>
                                    <dd className="mt-0.5 text-sm font-medium text-gray-300">{fact.value}</dd>
                                </div>
                            ))}
                        </dl>
                    ) : null}
                    {data?.attribution ? (
                        <p className="mt-3 text-[10px] text-gray-600">{data.attribution}</p>
                    ) : null}
                </>
            )}
        </>
    );
}

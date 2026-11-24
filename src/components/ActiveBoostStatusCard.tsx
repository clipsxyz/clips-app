import React from 'react';
import { getBoostWindow, updateBoostDelivery } from '../api/boost';
import GazetteerAlertSheet from './GazetteerAlertSheet';
import {
    boostReachProgress,
    boostTimeProgress,
    formatBoostRemaining,
    formatBoostWindow,
    type BoostDurationHours,
} from '../utils/boostProgress';

type Draft = {
    action: 'extend' | 'create';
    radiusKm: number;
    durationHours: BoostDurationHours;
    goal?: 'views' | 'profile_visits' | 'messages';
};

type Props = {
    postId: string;
    onExtend: (draft: Draft) => void;
    onBoostAgain: (draft: Draft) => void;
};

const DURATIONS: BoostDurationHours[] = [6, 12, 24, 72];

function asDuration(hours: number): BoostDurationHours {
    if (hours === 12 || hours === 24 || hours === 72) return hours;
    return 6;
}

export default function ActiveBoostStatusCard({ postId, onExtend, onBoostAgain }: Props) {
    const [windowState, setWindowState] = React.useState<Awaited<ReturnType<typeof getBoostWindow>> | null>(null);
    const [now, setNow] = React.useState(() => Date.now());
    const [picking, setPicking] = React.useState(false);
    const [busy, setBusy] = React.useState<'pause' | 'resume' | 'stop' | null>(null);
    const [stopAsk, setStopAsk] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        void getBoostWindow(postId).then((next) => {
            if (!cancelled) setWindowState(next);
        });
        const timer = window.setInterval(() => setNow(Date.now()), 30000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [postId]);

    if (!windowState?.hasBoost || windowState.startsAt == null || windowState.expiresAt == null) {
        return null;
    }

    const remaining = windowState.paused
        ? windowState.timeRemaining
        : Math.max(0, windowState.expiresAt - now);
    const active = windowState.isActive && !windowState.stopped && (windowState.paused || remaining > 0);
    const totalMs = Math.max(1, (windowState.durationHours || 0) * 3600000);
    const timeProgress = windowState.paused
        ? 1 - Math.min(1, remaining / totalMs)
        : active
            ? boostTimeProgress(windowState.startsAt, windowState.expiresAt, now)
            : 1;
    const reach = windowState.eligibleUsersCount;
    const views = windowState.viewsDelivered;
    const radius = windowState.radiusKm && windowState.radiusKm > 0 ? windowState.radiusKm : 2;
    const previous = asDuration(windowState.durationHours);
    const goalLine = windowState.goal === 'profile_visits'
        ? `${windowState.profileVisits.toLocaleString()} profile visits`
        : windowState.goal === 'messages'
            ? `${windowState.messageStarts.toLocaleString()} messages`
            : `${views.toLocaleString()} views${reach > 0 ? ` of ${reach.toLocaleString()} estimated` : ''}`;

    const applyDelivery = async (action: 'pause' | 'resume' | 'stop') => {
        setBusy(action);
        try {
            const next = await updateBoostDelivery(postId, action);
            setWindowState(next);
        } finally {
            setBusy(null);
        }
    };

    const changeDelivery = (action: 'pause' | 'resume' | 'stop') => {
        if (action === 'stop') {
            setStopAsk(true);
            return;
        }
        void applyDelivery(action);
    };

    return (
        <div className="mt-1.5 rounded-xl border border-white/15 bg-white/[0.04] p-2 text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                {windowState.paused ? 'Paused' : active ? 'Active boost' : 'Boost ended'}
            </p>
            <p className="mt-1 text-[12px] font-semibold text-white">
                {windowState.paused
                    ? `${formatBoostRemaining(remaining)} left of ${formatBoostWindow(windowState.durationHours || previous)}`
                    : active
                        ? `${formatBoostRemaining(remaining)} remaining of ${formatBoostWindow(windowState.durationHours || previous)}`
                        : 'This boost has finished'}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-sky-400" style={{ width: `${Math.round(timeProgress * 100)}%` }} />
            </div>
            <p className="mt-2 text-[12px] font-semibold text-white">{goalLine}</p>
            {windowState.goal !== 'views' ? (
                <p className="text-[11px] text-gray-300">
                    {views.toLocaleString()} views{reach > 0 ? ` of ${reach.toLocaleString()} estimated` : ''}
                </p>
            ) : null}
            {reach > 0 ? (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                        className="h-full rounded-full bg-violet-400"
                        style={{ width: `${Math.round(boostReachProgress(views, reach) * 100)}%` }}
                    />
                </div>
            ) : null}
            {active ? (
                <>
                    {windowState.paused ? (
                        <button
                            type="button"
                            disabled={busy != null}
                            onClick={() => { void changeDelivery('resume'); }}
                            className="mt-2 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-black"
                        >
                            {busy === 'resume' ? 'Resuming…' : 'Resume'}
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => setPicking((open) => !open)}
                                className="mt-2 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-black"
                            >
                                Extend boost
                            </button>
                            {picking ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {DURATIONS.map((hours) => (
                                        <button
                                            key={hours}
                                            type="button"
                                            onClick={() => onExtend({ action: 'extend', radiusKm: radius, durationHours: hours, goal: windowState.goal })}
                                            className="rounded-full border border-white/30 px-2 py-1 text-[11px] font-bold text-white"
                                        >
                                            {formatBoostWindow(hours)}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                            <button
                                type="button"
                                disabled={busy != null}
                                onClick={() => { void changeDelivery('pause'); }}
                                className="mt-2 rounded-full border border-white/30 px-3 py-1 text-[11px] font-bold text-white"
                            >
                                {busy === 'pause' ? 'Pausing…' : 'Pause'}
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        disabled={busy != null}
                        onClick={() => { void changeDelivery('stop'); }}
                        className="mt-2 rounded-full border border-red-300/40 px-3 py-1 text-[11px] font-bold text-red-200"
                    >
                        {busy === 'stop' ? 'Stopping…' : 'Stop boost'}
                    </button>
                </>
            ) : (
                <button
                    type="button"
                    onClick={() => onBoostAgain({ action: 'create', radiusKm: radius, durationHours: previous, goal: windowState.goal })}
                    className="mt-2 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-black"
                >
                    Boost again
                </button>
            )}
            <GazetteerAlertSheet
                visible={stopAsk}
                title="Stop this boost?"
                message="Delivery ends now. The post stays up, and the unused time is not refunded."
                icon="alert"
                showIcon
                confirmButtonText="Stop boost"
                cancelButtonText="Keep it running"
                showCancelButton
                onConfirm={() => {
                    setStopAsk(false);
                    void applyDelivery('stop');
                }}
                onDismiss={() => setStopAsk(false)}
            />
        </div>
    );
}

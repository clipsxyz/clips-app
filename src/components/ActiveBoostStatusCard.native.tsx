import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter, Pressable, StyleSheet, Text, View } from 'react-native';
import { gazetteerAlert } from '../utils/gazetteerAlertNative';
import type { Post } from '../types';
import { getBoostWindow, updateBoostDelivery, type BoostWindow } from '../api/boost';
import {
    boostReachProgress,
    boostTimeProgress,
    formatBoostRemaining,
    formatBoostWindow,
    type BoostDurationHours,
} from '../utils/boostProgress';
import BoostSelectionModal from './BoostSelectionModal.native';
import { BOOST_STATUS_REFRESH_EVENT } from '../navigation/linking';

type Draft = {
    action: 'extend' | 'create';
    radiusKm: number;
    durationHours: BoostDurationHours;
    goal?: BoostWindow['goal'];
};

type Props = {
    post: Post;
    onExtend?: (draft: Draft) => void;
    onBoostAgain?: (draft: Draft) => void;
};

const DURATIONS: BoostDurationHours[] = [6, 12, 24, 72];

function asDuration(hours: number): BoostDurationHours {
    if (hours === 12 || hours === 24 || hours === 72) return hours;
    return 6;
}

export default function ActiveBoostStatusCard({ post, onExtend, onBoostAgain }: Props) {
    const [windowState, setWindowState] = useState<BoostWindow | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [pickingExtend, setPickingExtend] = useState(false);
    const [localDraft, setLocalDraft] = useState<Draft | null>(null);
    const [busy, setBusy] = useState<'pause' | 'resume' | 'stop' | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = () => {
            void getBoostWindow(post.id).then((next) => {
                if (!cancelled) setWindowState(next);
            });
        };
        load();
        const timer = setInterval(() => setNow(Date.now()), 30000);
        const sub = DeviceEventEmitter.addListener(BOOST_STATUS_REFRESH_EVENT, load);
        return () => {
            cancelled = true;
            clearInterval(timer);
            sub.remove();
        };
    }, [post.id]);

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
    const goalLine = windowState.goal === 'profile_visits'
        ? `${windowState.profileVisits.toLocaleString()} profile visits`
        : windowState.goal === 'messages'
            ? `${windowState.messageStarts.toLocaleString()} messages`
            : reach > 0
                ? `${views.toLocaleString()} views of ${reach.toLocaleString()} estimated`
                : `${views.toLocaleString()} views`;
    const reachProgress = boostReachProgress(views, reach);
    const radius = windowState.radiusKm && windowState.radiusKm > 0 ? windowState.radiusKm : 2;
    const previousDuration = asDuration(windowState.durationHours);

    const startExtend = (hours: BoostDurationHours) => {
        const draft: Draft = { action: 'extend', radiusKm: radius, durationHours: hours, goal: windowState.goal };
        setPickingExtend(false);
        if (onExtend) {
            onExtend(draft);
            return;
        }
        setLocalDraft(draft);
    };

    const startAgain = () => {
        const draft: Draft = { action: 'create', radiusKm: radius, durationHours: previousDuration, goal: windowState.goal };
        if (onBoostAgain) {
            onBoostAgain(draft);
            return;
        }
        setLocalDraft(draft);
    };

    const applyDelivery = async (action: 'pause' | 'resume' | 'stop') => {
        setBusy(action);
        try {
            const next = await updateBoostDelivery(post.id, action);
            setWindowState(next);
            DeviceEventEmitter.emit(BOOST_STATUS_REFRESH_EVENT);
        } catch (err) {
            gazetteerAlert('Boost update failed', err instanceof Error ? err.message : 'Please try again.');
        } finally {
            setBusy(null);
        }
    };

    const changeDelivery = (action: 'pause' | 'resume' | 'stop') => {
        if (action === 'stop') {
            gazetteerAlert(
                'Stop this boost?',
                'Delivery ends now. The post stays up, and the unused time is not refunded.',
                [
                    { text: 'Keep it running', style: 'cancel' },
                    { text: 'Stop boost', style: 'destructive', onPress: () => { void applyDelivery('stop'); } },
                ],
            );
            return;
        }
        void applyDelivery(action);
    };

    return (
        <View style={styles.card}>
            <Text style={styles.kicker}>{windowState.paused ? 'Paused' : active ? 'Active boost' : 'Boost ended'}</Text>
            <Text style={styles.remaining}>
                {windowState.paused
                    ? `${formatBoostRemaining(remaining)} left of ${formatBoostWindow(windowState.durationHours || previousDuration)}`
                    : active
                        ? `${formatBoostRemaining(remaining)} remaining of ${formatBoostWindow(windowState.durationHours || previousDuration)}`
                        : 'This boost has finished'}
            </Text>
            <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(timeProgress * 100)}%` }]} />
            </View>
            <Text style={styles.views}>{goalLine}</Text>
            {windowState.goal !== 'views' ? (
                <Text style={styles.viewsSecondary}>
                    {views.toLocaleString()} views{reach > 0 ? ` of ${reach.toLocaleString()} estimated` : ''}
                </Text>
            ) : null}
            {reach > 0 ? (
                <View style={styles.track}>
                    <View style={[styles.fillReach, { width: `${Math.round(reachProgress * 100)}%` }]} />
                </View>
            ) : null}
            {active ? (
                <>
                    {windowState.paused ? (
                        <Pressable style={styles.action} disabled={busy != null} onPress={() => changeDelivery('resume')}>
                            <Text style={styles.actionText}>{busy === 'resume' ? 'Resuming…' : 'Resume'}</Text>
                        </Pressable>
                    ) : (
                        <>
                            <Pressable style={styles.action} onPress={() => setPickingExtend((open) => !open)}>
                                <Text style={styles.actionText}>Extend boost</Text>
                            </Pressable>
                            {pickingExtend ? (
                                <View style={styles.durations}>
                                    {DURATIONS.map((hours) => (
                                        <Pressable key={hours} style={styles.duration} onPress={() => startExtend(hours)}>
                                            <Text style={styles.durationText}>{formatBoostWindow(hours)}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            ) : null}
                            <Pressable style={styles.secondary} disabled={busy != null} onPress={() => changeDelivery('pause')}>
                                <Text style={styles.secondaryText}>{busy === 'pause' ? 'Pausing…' : 'Pause'}</Text>
                            </Pressable>
                        </>
                    )}
                    <Pressable style={styles.secondary} disabled={busy != null} onPress={() => changeDelivery('stop')}>
                        <Text style={styles.stopText}>{busy === 'stop' ? 'Stopping…' : 'Stop boost'}</Text>
                    </Pressable>
                </>
            ) : (
                <Pressable style={styles.action} onPress={startAgain}>
                    <Text style={styles.actionText}>Boost again</Text>
                </Pressable>
            )}
            <BoostSelectionModal
                isOpen={localDraft != null}
                post={post}
                selectedPost={post}
                checkoutAction={localDraft?.action === 'extend' ? 'extend' : 'create'}
                initialRadiusKm={localDraft?.radiusKm}
                initialDurationHours={localDraft?.durationHours}
                initialGoal={windowState.goal}
                startStep={3}
                onClose={() => setLocalDraft(null)}
                onSelect={() => setLocalDraft(null)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 12,
        marginBottom: 12,
        padding: 12,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    kicker: {
        color: '#86EFAC',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    remaining: {
        color: '#F9FAFB',
        fontSize: 14,
        fontWeight: '700',
        marginTop: 4,
        marginBottom: 8,
    },
    track: {
        height: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.12)',
        overflow: 'hidden',
    },
    fill: {
        height: 6,
        borderRadius: 999,
        backgroundColor: '#38BDF8',
    },
    fillReach: {
        height: 6,
        borderRadius: 999,
        backgroundColor: '#A78BFA',
    },
    views: {
        color: '#F9FAFB',
        fontSize: 13,
        fontWeight: '700',
        marginTop: 8,
        marginBottom: 4,
    },
    viewsSecondary: {
        color: '#D1D5DB',
        fontSize: 12,
        marginBottom: 6,
    },
    secondary: {
        marginTop: 8,
        alignSelf: 'flex-start',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
    },
    secondaryText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    stopText: {
        color: '#FCA5A5',
        fontSize: 13,
        fontWeight: '700',
    },
    action: {
        marginTop: 10,
        alignSelf: 'flex-start',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
        backgroundColor: '#FFFFFF',
    },
    actionText: {
        color: '#111827',
        fontSize: 13,
        fontWeight: '700',
    },
    durations: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    duration: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    durationText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
});

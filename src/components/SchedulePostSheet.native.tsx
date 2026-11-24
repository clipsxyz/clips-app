import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type Props = {
    visible: boolean;
    initial: Date | null;
    onClose: () => void;
    onConfirm: (when: Date) => void;
};

export function formatScheduleWhen(date: Date): string {
    return date.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

const MINUTE_STEP = 5;
const DAY_COUNT = 14;

function startOfDay(date: Date): Date {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
}

function withClock(day: Date, hour: number, minute: number): Date {
    const next = new Date(day);
    next.setHours(hour, minute, 0, 0);
    return next;
}

function dayLabel(day: Date, today: Date): string {
    const start = startOfDay(day).getTime();
    const todayStart = startOfDay(today).getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    if (start === todayStart) return 'Today';
    if (start === todayStart + oneDay) return 'Tomorrow';
    return day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function SchedulePostSheet({ visible, initial, onClose, onConfirm }: Props) {
    const [dayIndex, setDayIndex] = useState(1);
    const [hour, setHour] = useState(9);
    const [minute, setMinute] = useState(0);

    const days = useMemo(() => {
        const today = startOfDay(new Date());
        return Array.from({ length: DAY_COUNT }, (_, index) => {
            const day = new Date(today);
            day.setDate(today.getDate() + index);
            return day;
        });
    }, [visible]);

    useEffect(() => {
        if (!visible) return;
        const seed = initial && initial.getTime() > Date.now() ? initial : new Date(Date.now() + 60 * 60 * 1000);
        const today = startOfDay(new Date());
        const diff = Math.round((startOfDay(seed).getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
        setDayIndex(Math.min(DAY_COUNT - 1, Math.max(0, diff)));
        setHour(seed.getHours());
        setMinute(Math.floor(seed.getMinutes() / MINUTE_STEP) * MINUTE_STEP);
    }, [visible, initial]);

    const selected = withClock(days[dayIndex] ?? new Date(), hour, minute);
    const earliest = Date.now() + 60 * 1000;
    const canConfirm = selected.getTime() >= earliest;

    const shift = (current: number, delta: number, size: number) => (current + delta + size) % size;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={() => {}}>
                    <Text style={styles.title}>Schedule post</Text>
                    <Text style={styles.subtitle}>It goes on the feed at this time.</Text>

                    <Text style={styles.label}>Day</Text>
                    <View style={styles.stepRow}>
                        <Pressable
                            style={styles.stepButton}
                            onPress={() => setDayIndex((value) => Math.max(0, value - 1))}
                            accessibilityLabel="Previous day"
                        >
                            <Icon name="chevron-back" size={20} color="#FFFFFF" />
                        </Pressable>
                        <Text style={styles.value}>{dayLabel(days[dayIndex] ?? new Date(), new Date())}</Text>
                        <Pressable
                            style={styles.stepButton}
                            onPress={() => setDayIndex((value) => Math.min(DAY_COUNT - 1, value + 1))}
                            accessibilityLabel="Next day"
                        >
                            <Icon name="chevron-forward" size={20} color="#FFFFFF" />
                        </Pressable>
                    </View>

                    <Text style={styles.label}>Time</Text>
                    <View style={styles.stepRow}>
                        <Pressable
                            style={styles.stepButton}
                            onPress={() => setHour((value) => shift(value, -1, 24))}
                            accessibilityLabel="Earlier hour"
                        >
                            <Icon name="chevron-back" size={20} color="#FFFFFF" />
                        </Pressable>
                        <Text style={styles.value}>
                            {`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`}
                        </Text>
                        <Pressable
                            style={styles.stepButton}
                            onPress={() => setHour((value) => shift(value, 1, 24))}
                            accessibilityLabel="Later hour"
                        >
                            <Icon name="chevron-forward" size={20} color="#FFFFFF" />
                        </Pressable>
                    </View>
                    <View style={styles.minuteRow}>
                        <Pressable
                            style={styles.minuteButton}
                            onPress={() => setMinute((value) => shift(value, -MINUTE_STEP, 60))}
                        >
                            <Text style={styles.minuteText}>−5 min</Text>
                        </Pressable>
                        <Pressable
                            style={styles.minuteButton}
                            onPress={() => setMinute((value) => shift(value, MINUTE_STEP, 60))}
                        >
                            <Text style={styles.minuteText}>+5 min</Text>
                        </Pressable>
                    </View>

                    {!canConfirm ? (
                        <Text style={styles.hint}>Choose a time at least a minute from now.</Text>
                    ) : null}

                    <Pressable
                        style={[styles.confirm, !canConfirm && styles.confirmDisabled]}
                        disabled={!canConfirm}
                        onPress={() => onConfirm(selected)}
                    >
                        <Text style={styles.confirmText}>Use this time</Text>
                    </Pressable>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    sheet: {
        paddingHorizontal: 20,
        paddingTop: 22,
        paddingBottom: 28,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        backgroundColor: '#16181D',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    subtitle: {
        color: 'rgba(255,255,255,0.62)',
        fontSize: 14,
        marginTop: 4,
        marginBottom: 16,
    },
    label: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.4,
        marginBottom: 8,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    stepButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    value: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    minuteRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 12,
    },
    minuteButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    minuteText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    hint: {
        color: '#FCA5A5',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 10,
    },
    confirm: {
        minHeight: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    confirmDisabled: {
        opacity: 0.4,
    },
    confirmText: {
        color: '#111111',
        fontSize: 16,
        fontWeight: '700',
    },
});

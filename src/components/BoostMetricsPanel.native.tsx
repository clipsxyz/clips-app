import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import type { Post } from '../types';
import { getActiveBoost, getBoostAnalytics, getBoostTimeRemaining } from '../api/boost';

type Props = {
    post: Post;
    isOpen: boolean;
};

function feedTypeLabel(feedType: string): string {
    switch (feedType) {
        case 'local':
            return 'Local Newsfeed';
        case 'regional':
            return 'Regional Newsfeed';
        case 'national':
            return 'National Newsfeed';
        default:
            return 'Newsfeed';
    }
}

function formatTimeRemaining(ms: number): string {
    if (ms <= 0) return '';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

export default function BoostMetricsPanel({ post, isOpen }: Props) {
    const [isBoosted, setIsBoosted] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [feedType, setFeedType] = useState('');
    const [impressions, setImpressions] = useState(0);
    const [profileVisits, setProfileVisits] = useState(0);
    const [messageStarts, setMessageStarts] = useState(0);
    const [likes, setLikes] = useState(post.stats.likes);
    const [comments, setComments] = useState(post.stats.comments);
    const [shares, setShares] = useState(post.stats.shares);

    useEffect(() => {
        let cancelled = false;
        async function checkBoost() {
            const boost = await getActiveBoost(post.id);
            if (cancelled) return;
            if (boost?.isActive) {
                setIsBoosted(true);
                setFeedType(feedTypeLabel(boost.feedType));
                const remaining = await getBoostTimeRemaining(post.id);
                if (!cancelled) setTimeRemaining(remaining);
            } else {
                setIsBoosted(false);
            }
        }
        void checkBoost();
        const interval = setInterval(() => void checkBoost(), 60000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [post.id]);

    useEffect(() => {
        if (!isOpen || !isBoosted) return;
        let cancelled = false;
        void getBoostAnalytics(post.id, 'all')
            .then((data) => {
                if (cancelled || !data?.analytics) return;
                setImpressions(data.analytics.impressions);
                setProfileVisits(data.analytics.profileVisits);
                setMessageStarts(data.analytics.messageStarts);
                setLikes(data.analytics.likes);
                setComments(data.analytics.comments);
                setShares(data.analytics.shares);
            })
            .catch(() => {
                if (!cancelled) {
                    setImpressions(post.stats.views);
                    setLikes(post.stats.likes);
                    setComments(post.stats.comments);
                    setShares(post.stats.shares);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, isBoosted, post.id, post.stats]);

    if (!isBoosted || !isOpen) return null;

    const stats = [
        { icon: 'eye-outline', label: 'Impressions', value: impressions },
        { icon: 'person-outline', label: 'Profile visits', value: profileVisits },
        { icon: 'chatbubbles-outline', label: 'Messages', value: messageStarts },
        { icon: 'thumbs-up-outline', label: 'Likes', value: likes },
        { icon: 'chatbubble-outline', label: 'Comments', value: comments },
        { icon: 'share-outline', label: 'Shares', value: shares },
    ];

    return (
        <LinearGradient
            colors={['#3b82f6', '#a855f7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBorder}
        >
            <View style={styles.inner}>
                <View style={styles.headerRow}>
                    <View style={styles.titleRow}>
                        <Icon name="trending-up" size={20} color="#7A8AF0" />
                        <Text style={styles.title}>Boost Metrics</Text>
                    </View>
                    <View style={styles.metaRow}>
                        <Text style={styles.feedTypePill}>{feedType}</Text>
                        {timeRemaining > 0 ? (
                            <Text style={styles.timeLeft}>{formatTimeRemaining(timeRemaining)} left</Text>
                        ) : null}
                    </View>
                </View>
                <View style={styles.grid}>
                    {stats.map((row) => (
                        <View key={row.label} style={styles.statCell}>
                            <View style={styles.statLabelRow}>
                                <Icon name={row.icon} size={14} color="#9CA3AF" />
                                <Text style={styles.statLabel}>{row.label}</Text>
                            </View>
                            <Text style={styles.statValue}>{row.value.toLocaleString()}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradientBorder: {
        marginHorizontal: 12,
        marginBottom: 12,
        borderRadius: 12,
        padding: 2,
    },
    inner: {
        backgroundColor: '#111827',
        borderRadius: 10,
        padding: 14,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 8,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        color: '#F9FAFB',
        fontSize: 16,
        fontWeight: '700',
    },
    metaRow: {
        alignItems: 'flex-end',
        gap: 4,
    },
    feedTypePill: {
        color: '#A5B4FC',
        fontSize: 11,
        fontWeight: '600',
        backgroundColor: 'rgba(99, 102, 241, 0.25)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
    },
    timeLeft: {
        color: '#9CA3AF',
        fontSize: 11,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    statCell: {
        width: '30%',
        minWidth: 96,
    },
    statLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    statLabel: {
        color: '#9CA3AF',
        fontSize: 11,
        fontWeight: '600',
    },
    statValue: {
        color: '#F9FAFB',
        fontSize: 22,
        fontWeight: '800',
    },
});

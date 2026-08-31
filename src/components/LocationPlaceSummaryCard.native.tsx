import React from 'react';
import { StyleSheet, View } from 'react-native';
import LocationPlaceSummaryBody from './LocationPlaceSummaryBody.native';
import { usePlaceSummary } from '../hooks/usePlaceSummary';

type Props = {
    locationLabel: string;
    placeId?: string | null;
};

export default function LocationPlaceSummaryCard({ locationLabel, placeId }: Props) {
    const { data, loading } = usePlaceSummary(locationLabel, placeId);

    if (!loading && !data?.summary) return null;

    return (
        <View style={styles.card}>
            <LocationPlaceSummaryBody locationLabel={locationLabel} data={data} loading={loading} />
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginTop: 16,
        marginHorizontal: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(55, 65, 81, 0.9)',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        paddingHorizontal: 20,
        paddingVertical: 24,
    },
});

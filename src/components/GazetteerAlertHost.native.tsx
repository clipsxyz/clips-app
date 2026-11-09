import React, { useEffect, useRef, useState } from 'react';
import GazetteerAlertSheet from './GazetteerAlertSheet.native';
import GazetteerMenuSheet from './GazetteerMenuSheet.native';
import {
    finishGazetteerAlert,
    subscribeGazetteerAlerts,
    type GazetteerAlertRequest,
} from '../utils/gazetteerAlertNative';

/** One app-wide Gazetteer sheet for notices, confirms, and short choice lists. */
export default function GazetteerAlertHost() {
    const [request, setRequest] = useState<GazetteerAlertRequest | null>(null);
    const requestRef = useRef<GazetteerAlertRequest | null>(null);
    const pickedRef = useRef(false);

    useEffect(() => {
        return subscribeGazetteerAlerts((next) => {
            pickedRef.current = false;
            requestRef.current = next;
            setRequest(next);
        });
    }, []);

    if (!request) return null;

    if (request.kind === 'menu') {
        return (
            <GazetteerMenuSheet
                visible
                title={request.title}
                subtitle={request.message}
                options={request.options}
                cancelLabel={request.cancelText}
                onWillSelect={() => {
                    pickedRef.current = true;
                }}
                onDismiss={() => {
                    const picked = pickedRef.current;
                    pickedRef.current = false;
                    const current = requestRef.current;
                    if (!current || current.id !== request.id) return;
                    if (!picked) current.onDismiss?.();
                    finishGazetteerAlert(current.id);
                }}
            />
        );
    }

    return (
        <GazetteerAlertSheet
            visible
            title={request.title}
            message={request.message}
            icon={request.icon}
            confirmButtonText={request.confirmText}
            cancelButtonText={request.cancelText}
            showCancelButton={request.showCancel}
            confirmDestructive={request.destructive}
            onConfirm={() => {
                const current = requestRef.current;
                if (!current || current.id !== request.id) return;
                current.onConfirm?.();
                finishGazetteerAlert(current.id);
            }}
            onDismiss={() => {
                const current = requestRef.current;
                if (!current || current.id !== request.id) return;
                current.onDismiss?.();
                finishGazetteerAlert(current.id);
            }}
        />
    );
}

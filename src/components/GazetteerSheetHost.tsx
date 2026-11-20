import React, { useEffect, useState } from 'react';
import GazetteerAlertSheet from './GazetteerAlertSheet';

type SheetRequest = {
    id: number;
    title: string;
    message?: string;
    confirmText: string;
    cancelText: string;
    showCancel: boolean;
    resolve: (confirmed: boolean) => void;
};

let nextId = 1;
let current: SheetRequest | null = null;
const queue: SheetRequest[] = [];
let subscriber: ((request: SheetRequest | null) => void) | null = null;

function present(request: SheetRequest) {
    if (current) {
        queue.push(request);
        return;
    }
    current = request;
    subscriber?.(current);
}

function finish(id: number, confirmed: boolean) {
    if (!current || current.id !== id) return;
    const done = current;
    current = queue.shift() ?? null;
    subscriber?.(current);
    done.resolve(confirmed);
}

export function askGazetteerSheet(options: {
    title: string;
    message?: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
    showCancelButton?: boolean;
}): Promise<boolean> {
    return new Promise((resolve) => {
        let settled = false;
        const finishOnce = (confirmed: boolean) => {
            if (settled) return;
            settled = true;
            resolve(confirmed);
        };
        present({
            id: nextId++,
            title: options.title,
            message: options.message,
            confirmText: options.confirmButtonText || 'OK',
            cancelText: options.cancelButtonText || 'Cancel',
            showCancel: options.showCancelButton === true,
            resolve: finishOnce,
        });
    });
}

export function confirmPrivateAccountFollow(): Promise<boolean> {
    return askGazetteerSheet({
        title: 'This Account is Private',
        message: "To view this user's profile you must be following them.",
        confirmButtonText: 'Follow',
        cancelButtonText: 'Cancel',
        showCancelButton: true,
    });
}

/** One app-wide sheet so follow prompts use the current Gazetteer card. */
export default function GazetteerSheetHost() {
    const [request, setRequest] = useState<SheetRequest | null>(null);

    useEffect(() => {
        subscriber = setRequest;
        setRequest(current);
        return () => {
            if (subscriber === setRequest) subscriber = null;
        };
    }, []);

    if (!request) return null;

    return (
        <GazetteerAlertSheet
            visible
            title={request.title}
            message={request.message}
            confirmButtonText={request.confirmText}
            cancelButtonText={request.cancelText}
            showCancelButton={request.showCancel}
            showIcon={false}
            onConfirm={() => finish(request.id, true)}
            onDismiss={() => finish(request.id, false)}
        />
    );
}

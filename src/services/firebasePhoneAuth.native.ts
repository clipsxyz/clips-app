export type FirebasePhoneConfirmation = {
    confirm: (
        code: string,
    ) => Promise<{ user?: { getIdToken: (forceRefresh?: boolean) => Promise<string> } } | null>;
};

export async function startFirebasePhoneSignIn(e164Phone: string): Promise<FirebasePhoneConfirmation> {
    const authModule = await import('@react-native-firebase/auth');
    return authModule.default().signInWithPhoneNumber(e164Phone);
}

export async function firebaseIdTokenFromConfirmation(
    confirmation: FirebasePhoneConfirmation,
    code: string,
): Promise<string> {
    const signedIn = await confirmation.confirm(code);
    const authModule = await import('@react-native-firebase/auth');
    const current = signedIn?.user ?? authModule.default().currentUser;
    if (!current) {
        throw new Error('Phone verification did not return a Firebase user.');
    }
    return current.getIdToken(true);
}

type FirebasePhoneSnapshot = {
    verificationId?: string;
    code?: string | null;
    state?: string;
    error?: { message?: string; code?: string } | null;
};

/**
 * Text a code for a phone change. The signed-in Firebase user stays signed in;
 * `verifyPhoneNumber` does not replace the session the way `signInWithPhoneNumber` does.
 */
export async function requestFirebasePhoneUpdate(
    e164Phone: string,
): Promise<{ verificationId: string; code?: string }> {
    const authModule = await import('@react-native-firebase/auth');
    const auth = authModule.default;
    if (!auth().currentUser) {
        throw new Error('Verify your current phone on this device before changing it.');
    }

    const listener = auth().verifyPhoneNumber(e164Phone) as {
        then?: (
            onFulfilled: (snapshot: FirebasePhoneSnapshot) => void,
            onRejected?: (error: unknown) => void,
        ) => void;
        on?: (event: string, cb: (snapshot: FirebasePhoneSnapshot) => void) => void;
    };

    const snapshot = await new Promise<FirebasePhoneSnapshot>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            fail(new Error('The verification text did not arrive. Try again.'));
        }, 60000);
        const finish = (next: FirebasePhoneSnapshot) => {
            if (settled) return;
            if (next?.error || String(next?.state || '') === 'error') {
                settled = true;
                clearTimeout(timer);
                reject(next?.error || new Error('Could not send a verification code.'));
                return;
            }
            const verificationId = String(next?.verificationId || '').trim();
            if (!verificationId) return;
            settled = true;
            clearTimeout(timer);
            resolve(next);
        };
        function fail(error: unknown) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(error);
        }
        if (typeof listener.then === 'function') {
            listener.then(finish, fail);
        }
        if (typeof listener.on === 'function') {
            listener.on('state_changed', finish);
        }
    });

    return {
        verificationId: String(snapshot.verificationId || ''),
        code: typeof snapshot.code === 'string' ? snapshot.code : undefined,
    };
}

/** Confirm the SMS code, then replace the Firebase user's phone number. */
export async function applyFirebasePhoneUpdate(verificationId: string, code: string): Promise<string> {
    const authModule = await import('@react-native-firebase/auth');
    const auth = authModule.default;
    const current = auth().currentUser;
    if (!current) {
        throw new Error('Verify your current phone on this device before changing it.');
    }
    const credential = auth.PhoneAuthProvider.credential(verificationId, code);
    await current.updatePhoneNumber(credential);
    return current.getIdToken(true);
}

export function firebasePhoneErrorMessage(error: unknown): string {
    const code = String((error as { code?: string })?.code || '');
    if (code === 'auth/invalid-phone-number') {
        return 'Enter a valid phone number, including the country code.';
    }
    if (code === 'auth/too-many-requests') {
        return 'Too many attempts. Wait a moment and try again.';
    }
    if (code === 'auth/invalid-verification-code') {
        return 'Incorrect code. Try again.';
    }
    if (code === 'auth/session-expired' || code === 'auth/code-expired' || code === 'auth/invalid-verification-id') {
        return 'That code expired. Request a new one.';
    }
    if (code === 'auth/requires-recent-login') {
        return 'Confirm your current phone again, then change the number.';
    }
    if (code === 'auth/credential-already-in-use') {
        return 'That phone number is already used by another account.';
    }
    if (
        code === 'auth/missing-client-identifier' ||
        code === 'auth/app-not-authorized' ||
        code === 'auth/quota-exceeded'
    ) {
        return 'Phone verification is not available on this build yet.';
    }
    const message = (error as { message?: string })?.message;
    return message || 'Could not verify that phone number.';
}

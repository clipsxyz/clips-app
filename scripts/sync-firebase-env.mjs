/**
 * Sync Google Maps + Firebase env vars from native config, service account, and optional firebase-web.local.json.
 * Run: npm run sync:env
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readPlistValue(plistText, key) {
    const re = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`, 'i');
    const match = plistText.match(re);
    return match?.[1]?.trim() || '';
}

function loadAndroidFirebase() {
    const filePath = path.join(root, 'android', 'app', 'google-services.json');
    if (!fs.existsSync(filePath)) return null;
    const json = readJson(filePath);
    const client = json.client?.[0];
    return {
        projectId: json.project_info?.project_id || '',
        storageBucket: json.project_info?.storage_bucket || '',
        messagingSenderId: json.project_info?.project_number || '',
        apiKey: client?.api_key?.[0]?.current_key || '',
        mobileAppId: client?.client_info?.mobilesdk_app_id || '',
    };
}

function loadIosFirebase() {
    const candidates = [
        path.join(root, 'ios', 'ClipsApp', 'GoogleService-Info.plist'),
        path.join(root, 'ios', 'GoogleService-Info.plist'),
    ];
    const filePath = candidates.find((p) => fs.existsSync(p));
    if (!filePath) return null;
    const text = fs.readFileSync(filePath, 'utf8');
    return {
        projectId: readPlistValue(text, 'PROJECT_ID'),
        storageBucket: readPlistValue(text, 'STORAGE_BUCKET'),
        messagingSenderId: readPlistValue(text, 'GCM_SENDER_ID'),
        apiKey: readPlistValue(text, 'API_KEY'),
        mobileAppId: readPlistValue(text, 'GOOGLE_APP_ID'),
    };
}

function loadWebOverride() {
    const filePath = path.join(root, 'firebase-web.local.json');
    if (!fs.existsSync(filePath)) return null;
    try {
        return readJson(filePath);
    } catch (err) {
        console.warn('Could not parse firebase-web.local.json:', err);
        return null;
    }
}

function loadServiceAccount() {
    const filePath = path.join(root, 'laravel-backend', 'storage', 'app', 'firebase-auth.json');
    if (!fs.existsSync(filePath)) return null;
    try {
        return readJson(filePath);
    } catch (err) {
        console.warn('Could not parse firebase-auth.json:', err);
        return null;
    }
}

function base64Url(input) {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return buf
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

async function getServiceAccountAccessToken(serviceAccount) {
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = base64Url(
        JSON.stringify({
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/firebase',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now,
        }),
    );
    const unsigned = `${header}.${claim}`;
    const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key);
    const jwt = `${unsigned}.${base64Url(signature)}`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });
    const data = await response.json();
    if (!data.access_token) {
        throw new Error(data.error_description || data.error || 'Failed to obtain Google access token');
    }
    return data.access_token;
}

async function firebaseRequest(token, url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
        },
    });
    const data = await response.json();
    if (!response.ok) {
        const message = data.error?.message || response.statusText;
        throw new Error(`${url}: ${message}`);
    }
    return data;
}

async function waitForFirebaseOperation(token, operationName) {
    const url = operationName.startsWith('http')
        ? operationName
        : `https://firebase.googleapis.com/v1beta1/${operationName}`;

    for (let attempt = 0; attempt < 30; attempt += 1) {
        const operation = await firebaseRequest(token, url);
        if (operation.done) {
            if (operation.error) {
                throw new Error(operation.error.message || 'Firebase operation failed');
            }
            return operation.response;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error(`Timed out waiting for Firebase operation: ${operationName}`);
}

async function ensureWebFirebaseConfig(projectId, serviceAccount) {
    const token = await getServiceAccountAccessToken(serviceAccount);
    const listUrl = `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`;
    let list = await firebaseRequest(token, listUrl);
    let webApp = list.apps?.[0];

    if (!webApp) {
        const create = await firebaseRequest(token, listUrl, {
            method: 'POST',
            body: JSON.stringify({ displayName: 'Gazetteer Web' }),
        });
        if (create.name?.includes('operations/')) {
            await waitForFirebaseOperation(token, create.name);
        }
        list = await firebaseRequest(token, listUrl);
        webApp = list.apps?.[0];
    }

    if (!webApp?.appId) {
        throw new Error('No Firebase Web app found after provisioning');
    }

    const configUrl = `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps/${encodeURIComponent(webApp.appId)}/config`;
    const config = await firebaseRequest(token, configUrl);
    return {
        apiKey: config.apiKey || '',
        appId: config.appId || webApp.appId,
        measurementId: config.measurementId || '',
        authDomain: config.authDomain || `${projectId}.firebaseapp.com`,
        storageBucket: config.storageBucket || '',
        messagingSenderId: config.messagingSenderId || config.projectNumber || '',
    };
}

function upsertEnvLines(existing, updates) {
    const lines = existing.split(/\r?\n/);
    const keys = new Set(Object.keys(updates));
    const out = [];

    for (const line of lines) {
        const match = line.match(/^([A-Z0-9_]+)=/);
        if (match && keys.has(match[1])) {
            continue;
        }
        out.push(line);
    }

    while (out.length > 0 && out[out.length - 1].trim() === '') {
        out.pop();
    }

    for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null || value === '') continue;
        out.push(`${key}=${value}`);
    }
    out.push('');
    return out.join('\n');
}

function readEnvFile(relPath) {
    const filePath = path.join(root, relPath);
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf8');
}

function writeEnvFile(relPath, content) {
    fs.writeFileSync(path.join(root, relPath), content, 'utf8');
}

function getMapsKeyFromLaravelEnv(text) {
    const google = text.match(/^GOOGLE_MAPS_API_KEY=(.+)$/m)?.[1]?.trim();
    if (google) return google;
    return text.match(/^Maps_API_KEY=(.+)$/m)?.[1]?.trim() || '';
}

async function main() {
    const android = loadAndroidFirebase();
    const ios = loadIosFirebase();
    let webOverride = loadWebOverride();
    const base = android || ios;

    if (!base?.projectId) {
        console.error('Missing android/app/google-services.json or ios GoogleService-Info.plist');
        process.exit(1);
    }

    const serviceAccount = loadServiceAccount();
    const webLocalPath = path.join(root, 'firebase-web.local.json');

    if (serviceAccount?.project_id === base.projectId) {
        try {
            const provisioned = await ensureWebFirebaseConfig(base.projectId, serviceAccount);
            const merged = {
                apiKey: webOverride?.apiKey || provisioned.apiKey,
                appId: webOverride?.appId || provisioned.appId,
                measurementId: webOverride?.measurementId || provisioned.measurementId || '',
                vapidKey: webOverride?.vapidKey || '',
                mapsApiKey: webOverride?.mapsApiKey || '',
            };
            if (!webOverride || merged.apiKey !== webOverride.apiKey || merged.appId !== webOverride.appId) {
                writeJson(webLocalPath, merged);
                console.log('Updated firebase-web.local.json from Firebase Management API (web app + SDK config).');
            }
            webOverride = merged;
        } catch (err) {
            console.warn('Could not auto-provision Firebase Web app:', err.message);
        }
    }

    const laravelEnv = readEnvFile('laravel-backend/.env');
    const mapsKey = getMapsKeyFromLaravelEnv(laravelEnv) || webOverride?.mapsApiKey || '';

    const webApiKey = webOverride?.apiKey || '';
    const webAppId = webOverride?.appId || '';
    const vapidKey = webOverride?.vapidKey || '';
    const measurementId = webOverride?.measurementId || '';

    const viteUpdates = {
        VITE_GOOGLE_MAPS_API_KEY: mapsKey,
        VITE_FIREBASE_API_KEY: webApiKey,
        VITE_FIREBASE_AUTH_DOMAIN: `${base.projectId}.firebaseapp.com`,
        VITE_FIREBASE_PROJECT_ID: base.projectId,
        VITE_FIREBASE_STORAGE_BUCKET: base.storageBucket,
        VITE_FIREBASE_MESSAGING_SENDER_ID: base.messagingSenderId,
        VITE_FIREBASE_APP_ID: webAppId,
        VITE_FIREBASE_MEASUREMENT_ID: measurementId,
        VITE_FIREBASE_VAPID_KEY: vapidKey,
    };

    const laravelUpdates = {
        GOOGLE_MAPS_API_KEY: mapsKey,
        FIREBASE_PROJECT_ID: base.projectId,
        FIREBASE_CREDENTIALS: 'storage/app/firebase-auth.json',
    };

    writeEnvFile('.env', upsertEnvLines(readEnvFile('.env'), viteUpdates));
    writeEnvFile('laravel-backend/.env', upsertEnvLines(readEnvFile('laravel-backend/.env'), laravelUpdates));

    console.log('Synced .env and laravel-backend/.env from native Firebase config.');
    if (mapsKey) {
        console.log('  GOOGLE_MAPS_API_KEY / VITE_GOOGLE_MAPS_API_KEY: set');
    } else {
        console.warn('  Maps API key missing — add GOOGLE_MAPS_API_KEY to laravel-backend/.env');
    }

    if (webAppId && webApiKey) {
        console.log('  Web Firebase (apiKey + appId): set');
    } else {
        console.warn('  Web Firebase appId/apiKey missing — ensure laravel-backend/storage/app/firebase-auth.json exists and run sync again');
    }

    if (!vapidKey) {
        console.warn('');
        console.warn('Web push VAPID key still needed (one-time in Firebase Console):');
        console.warn('  Project gazetter26 → Project settings → Cloud Messaging → Web Push certificates');
        console.warn('  Copy the key pair into firebase-web.local.json as "vapidKey", then run: npm run sync:env');
    } else {
        console.log('  Web push VAPID: set');
    }

    const credPath = path.join(root, 'laravel-backend', 'storage', 'app', 'firebase-auth.json');
    if (!fs.existsSync(credPath)) {
        console.warn('');
        console.warn('Laravel service account missing: laravel-backend/storage/app/firebase-auth.json');
        console.warn('  Download from Firebase Console → Project settings → Service accounts → Generate new private key');
    }

    const misnamed = path.join(root, 'laravel-backend', 'storage', 'app', 'firebase-auth.json.json');
    if (fs.existsSync(misnamed) && fs.existsSync(credPath)) {
        fs.unlinkSync(misnamed);
        console.log('Removed duplicate firebase-auth.json.json (use firebase-auth.json).');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

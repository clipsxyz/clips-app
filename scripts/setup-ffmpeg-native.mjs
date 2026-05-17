/**
 * Downloads FFmpeg Kit binaries from de-id/ffmpeg-kit (Arthenica Maven/CocoaPods retired).
 * Run after npm install: npm run setup:ffmpeg-native
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const DE_ID_RELEASE = 'v6.0.2';
const ANDROID_URL = `https://github.com/de-id/ffmpeg-kit/releases/download/${DE_ID_RELEASE}/ffmpeg-kit-android.zip`;
const IOS_URL = `https://github.com/de-id/ffmpeg-kit/releases/download/${DE_ID_RELEASE}/ffmpeg-kit-ios.zip`;

const androidMavenRoot = path.join(root, 'android', 'ffmpeg-kit-local-maven');
const androidArtifactDir = path.join(
    androidMavenRoot,
    'com',
    'arthenica',
    'ffmpeg-kit-https-gpl',
    '6.0-2',
);
const androidAarName = 'ffmpeg-kit-https-gpl-6.0-2.aar';

const iosVendorDir = path.join(root, 'ios', 'FFmpegKitVendor');

async function download(url, destPath) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Download failed ${res.status}: ${url}`);
    }
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath));
}

function extractZip(zipPath, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    if (process.platform === 'win32') {
        execSync(
            `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force"`,
            { stdio: 'inherit' },
        );
    } else {
        execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' });
    }
}

function findFile(dir, name) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isFile() && entry.name === name) return full;
        if (entry.isDirectory()) {
            const hit = findFile(full, name);
            if (hit) return hit;
        }
    }
    return null;
}

function listXcframeworks(dir) {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name.endsWith('.xcframework'))
        .map((e) => path.join(dir, e.name));
}

async function setupAndroid(tmpDir) {
    const zipPath = path.join(tmpDir, 'ffmpeg-kit-android.zip');
    const extractDir = path.join(tmpDir, 'android-extract');
    console.log('Downloading Android FFmpeg Kit…');
    await download(ANDROID_URL, zipPath);
    extractZip(zipPath, extractDir);
    const aarPath = findFile(extractDir, 'ffmpeg-kit.aar');
    if (!aarPath) {
        throw new Error('ffmpeg-kit.aar not found in android zip');
    }
    await fs.promises.mkdir(androidArtifactDir, { recursive: true });
    await fs.promises.copyFile(aarPath, path.join(androidArtifactDir, androidAarName));
    const pom = `<?xml version="1.0" encoding="UTF-8"?>
<project xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd" xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.arthenica</groupId>
  <artifactId>ffmpeg-kit-https-gpl</artifactId>
  <version>6.0-2</version>
  <packaging>aar</packaging>
</project>
`;
    await fs.promises.writeFile(
        path.join(androidArtifactDir, 'ffmpeg-kit-https-gpl-6.0-2.pom'),
        pom,
        'utf8',
    );
    console.log('Android local Maven repo:', androidArtifactDir);
}

async function setupIos(tmpDir) {
    const zipPath = path.join(tmpDir, 'ffmpeg-kit-ios.zip');
    const extractDir = path.join(tmpDir, 'ios-extract');
    console.log('Downloading iOS FFmpeg Kit…');
    await download(IOS_URL, zipPath);
    extractZip(zipPath, extractDir);
    const frameworks = listXcframeworks(extractDir);
    if (frameworks.length === 0) {
        throw new Error('No .xcframework bundles found in ios zip');
    }
    await fs.promises.rm(iosVendorDir, { recursive: true, force: true });
    await fs.promises.mkdir(iosVendorDir, { recursive: true });
    for (const fw of frameworks) {
        const dest = path.join(iosVendorDir, path.basename(fw));
        await fs.promises.cp(fw, dest, { recursive: true });
    }
    console.log('iOS vendored frameworks:', iosVendorDir, `(${frameworks.length} xcframeworks)`);
}

async function main() {
    const marker = path.join(androidArtifactDir, androidAarName);
    const iosMarker = path.join(iosVendorDir, 'ffmpegkit.xcframework');
    if (fs.existsSync(marker) && fs.existsSync(iosMarker)) {
        console.log('FFmpeg native binaries already present; skipping download.');
        return;
    }
    const tmpDir = path.join(root, '.tmp-ffmpeg-setup');
    await fs.promises.mkdir(tmpDir, { recursive: true });
    try {
        if (!fs.existsSync(marker)) {
            await setupAndroid(tmpDir);
        }
        if (!fs.existsSync(iosMarker)) {
            await setupIos(tmpDir);
        }
        console.log('Done. Android: run dev:android | iOS: cd ios && pod install');
    } finally {
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

# React Native Version Status

Last updated: May 2026

## Current (installed)

| Package | Version |
|---------|---------|
| **React Native** | `0.85.3` (latest stable) |
| **React** | `19.2.x` (peer: `^19.2.3`) |
| **New Architecture** | Enabled (`newArchEnabled=true`) |
| **Hermes** | Enabled |

### Key native libraries (aligned with 0.85)

| Package | Version |
|---------|---------|
| react-native-reanimated | ^4.3.1 |
| react-native-screens | ^4.25.1 |
| react-native-gesture-handler | ^2.31.2 |
| react-native-safe-area-context | ^5.8.0 |
| @react-navigation/native | ^7.x |
| react-native-web | ^0.21.2 |

## Upgrade checklist (0.84 → 0.85) — completed in repo

### 1. JavaScript / npm

- [x] Bump `react-native` to `^0.85.3`
- [x] Bump `react` / `react-dom` to `^19.2.3`
- [x] Bump Reanimated, Screens, Gesture Handler, Safe Area Context
- [x] Add `@react-native/jest-preset` and set `jest.config.js` preset
- [x] Replace `StyleSheet.absoluteFillObject` → `StyleSheet.absoluteFill` (0.85 breaking change)
- [x] Run `npm install`

### 2. Node.js (required before building)

React Native 0.85 **drops EOL Node versions**. Use:

- **Node 20** ≥ `20.19.4`, or
- **Node 22+** (LTS)

Check: `node -v`

### 3. iOS (macOS only)

```bash
cd ios
pod install
cd ..
npm run dev:ios
```

If pods fail after upgrade, try:

```bash
cd ios
rm -rf Pods Podfile.lock build
pod install --repo-update
```

### 4. Android

**Windows + physical phone**

1. Set `ANDROID_HOME` to `%LOCALAPPDATA%\Android\Sdk` and add `platform-tools` to Path.
2. Set `JAVA_HOME` to Android Studio’s JBR, e.g. `C:\Program Files\Android\Android Studio\jbr`.
3. Enable USB debugging on the phone; verify with `adb devices`.
4. From repo root: `powershell -File scripts/run-android-dev.ps1` or `npm run dev:android`.

Gradle wrapper uses **8.14.3** (not 9.0). `android/local.properties` points at your SDK (gitignored).

```bash
cd android
./gradlew clean
cd ..
npm run dev:android
```

If Gradle cache issues: delete `android/.gradle` and `android/app/build`, then rebuild.

### 5. Smoke test after upgrade

- [ ] Feed loads (images + video autoplay)
- [ ] Image fullscreen + comments sheet
- [ ] Scenes (video-only vertical swipe)
- [ ] Create / camera / FFmpeg flows
- [ ] Push notifications (Firebase)
- [ ] Login / auth persistence

### 6. Optional follow-ups

- **Upgrade Helper**: [0.84 → 0.85 diff](https://react-native-community.github.io/upgrade-helper/?from=0.84.0&to=0.85.3) for any native template files we did not auto-merge
- **Experimental animation backend** (0.85.1+): opt-in via [release levels](https://reactnative.dev/docs/releases/release-levels) — not required for this upgrade
- **Metro TLS**: only if you need HTTPS dev server (see RN 0.85 blog)

## Breaking changes in 0.85 (handled / notes)

| Change | Status |
|--------|--------|
| `StyleSheet.absoluteFillObject` removed | Fixed in app code |
| Jest preset → `@react-native/jest-preset` | Fixed |
| Node.js EOL versions dropped | Use Node ≥ 20.19.4 |
| Legacy architecture | Already on New Arch only |

## Version policy

- **0.85.x** — Active (current)
- **0.84.x** — Active (previous); we upgraded from this
- **0.82.x and below** — Unsupported

See [React Native releases](https://reactnative.dev/versions).

## Commands

```bash
# Check installed versions
npm ls react-native react react-native-reanimated

# Web (unchanged)
npm run dev

# Native
npm run dev:ios
npm run dev:android
```

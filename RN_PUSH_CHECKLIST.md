# React Native Push Verification Checklist

Use this checklist after shipping push-related updates to ensure behavior is stable on real devices.

## Setup Preconditions
- Install and configure `@react-native-firebase/messaging` for Android and iOS.
- Confirm Firebase config files are present in native projects.
- Build and run on real devices (not simulator-only).

## Permission Flows
- Android 13+: first launch requests notification permission.
- Android 13+: deny permission and verify app does not crash.
- iOS: permission prompt appears and app continues when denied.

## Delivery States
- Foreground: send test push, verify app remains stable and receives payload.
- Background: send test push, tap notification, verify app opens expected screen.
- Killed app: send test push, tap notification, verify cold-start routing works.

## Routing Contract
- DM payload opens `Messages` with correct handle.
- Group payload opens `Messages` with `chatGroupId`.
- Story payload opens `Stories` with user/story params.
- Post payload opens `PostDetail` with `postId`.
- Unknown payload falls back to `Inbox` notifications tab.

## Token Lifecycle
- Login: token is registered to backend.
- Token refresh event updates backend token.
- Logout: token removal path is called and listeners are torn down.
- Re-login: token is re-registered successfully.

## Regression Safety
- Open/close app repeatedly and confirm no duplicate listener side-effects.
- Toggle notification preferences and verify persisted state survives app restart.

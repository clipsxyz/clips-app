#!/bin/zsh
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"
ulimit -n 65536 || true
# Wireless adb drops reverse often — always re-apply before Metro.
adb reverse --remove-all >/dev/null 2>&1 || true
adb reverse tcp:8081 tcp:8081 || true
adb reverse tcp:8000 tcp:8000 || true
echo "adb reverse:"
adb reverse --list || true
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--require ./scripts/metro-emfile-guard.cjs"
exec npx react-native start --host 0.0.0.0 --port 8081

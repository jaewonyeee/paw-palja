#!/usr/bin/env bash
# build-mobile.sh — Build the frontend and sync to native Capacitor projects.
#
# Usage:
#   ./scripts/build-mobile.sh              # build + sync all platforms
#   ./scripts/build-mobile.sh android      # build + sync android only
#   ./scripts/build-mobile.sh ios          # build + sync ios only
set -euo pipefail

PLATFORM="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "==> Installing dependencies..."
npm ci

echo "==> Building frontend (production)..."
npm run build

if [ -z "$PLATFORM" ]; then
  echo "==> Syncing all Capacitor platforms..."
  npx cap sync
elif [ "$PLATFORM" = "android" ]; then
  echo "==> Syncing Android..."
  npx cap sync android
elif [ "$PLATFORM" = "ios" ]; then
  echo "==> Syncing iOS..."
  npx cap sync ios
else
  echo "Unknown platform: $PLATFORM"
  echo "Usage: $0 [android|ios]"
  exit 1
fi

echo ""
echo "==> Build complete!"
echo ""
echo "Next steps:"
if [ "$PLATFORM" != "ios" ]; then
  echo "  Android: npx cap open android   (opens Android Studio)"
fi
if [ "$PLATFORM" != "android" ]; then
  echo "  iOS:     npx cap open ios        (opens Xcode — macOS only)"
fi

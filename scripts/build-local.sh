#!/bin/bash
set -e

# Local build script for development/testing
# Creates a packaged release with "local" channel (no auto-updates)

echo "=== Local Development Build ==="
echo ""

# Detect platform and architecture
OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
    Darwin)
        PLATFORM="osx"
        if [[ "$ARCH" == "arm64" ]]; then
            FULL_CHANNEL="osx-arm64-local"
            RUNTIME="osx-arm64"
            PACKAGED_DIR="out/Griptape Nodes-darwin-arm64"
        else
            FULL_CHANNEL="osx-x64-local"
            RUNTIME="osx-x64"
            PACKAGED_DIR="out/Griptape Nodes-darwin-x64"
        fi
        APP_DIR="$PACKAGED_DIR/Griptape Nodes.app"
        MAIN_EXE="griptape-nodes-desktop"
        ICON_PATH="generated/icons/icon.icns"
        ;;
    Linux)
        PLATFORM="linux"
        if [[ "$ARCH" == "aarch64" ]]; then
            FULL_CHANNEL="linux-arm64-local"
            RUNTIME="linux-arm64"
            PACKAGED_DIR="out/Griptape Nodes-linux-arm64"
        else
            FULL_CHANNEL="linux-x64-local"
            RUNTIME="linux-x64"
            PACKAGED_DIR="out/Griptape Nodes-linux-x64"
        fi
        APP_DIR="$PACKAGED_DIR"
        MAIN_EXE="griptape-nodes-desktop"
        ICON_PATH="generated/icons/icon.png"
        ;;
    *)
        echo "Error: Unsupported platform: $OS"
        echo "For Windows, use: npm run build:local:windows"
        exit 1
        ;;
esac

echo "Platform: $PLATFORM ($ARCH)"
echo "Channel: $FULL_CHANNEL"
echo ""

# Set environment variables
export NODE_ENV=production
export VELOPACK_CHANNEL="$FULL_CHANNEL"

# Build with electron-forge
echo "Step 1/2: Packaging with electron-forge..."
npm run package

VERSION=$(node -p "require('./package.json').version")

echo ""
echo "Step 2/2: Creating Velopack release..."
echo "Runtime: $RUNTIME"
echo "Packaged directory: $PACKAGED_DIR"

# Build vpk args based on platform
VPK_ARGS=(
    --packId "ai.griptape.nodes.desktop"
    --packVersion "$VERSION"
    --packTitle "Griptape Nodes"
    --mainExe "$MAIN_EXE"
    --icon "$ICON_PATH"
    --outputDir "Releases"
    --runtime "$RUNTIME"
    --channel "$FULL_CHANNEL"
)

case "$PLATFORM" in
    osx)
        VPK_ARGS+=(--packDir "$APP_DIR")
        VPK_ARGS+=(--noInst)
        ;;
    linux)
        VPK_ARGS+=(--packDir "$APP_DIR")
        ;;
esac

vpk pack "${VPK_ARGS[@]}"

echo ""
echo "=== Build Complete ==="
echo ""
echo "Output files in: ./Releases/"
echo ""
echo "To run the packaged app:"
case "$PLATFORM" in
    osx)
        echo "  open \"$APP_DIR\""
        ;;
    linux)
        APPIMAGE=$(find Releases -name "*.AppImage" -type f | head -1)
        if [[ -n "$APPIMAGE" ]]; then
            echo "  chmod +x \"$APPIMAGE\" && \"$APPIMAGE\""
        else
            echo "  (AppImage should be in ./Releases/)"
        fi
        ;;
esac
echo ""
echo "Note: This is a 'local' channel build - auto-updates are disabled."

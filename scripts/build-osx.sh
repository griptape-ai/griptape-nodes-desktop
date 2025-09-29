#!/bin/bash
set -e

# Accept channel as argument, default to stable
CHANNEL=${1:-stable}

echo "Building for macOS (channel: $CHANNEL)..."

# Build with electron-forge first
npm run package

# Detect architecture
ARCH=$(uname -m)
if [[ "$ARCH" == "arm64" ]]; then
    RUNTIME="osx-arm64"
    PACKAGED_DIR="out/Griptape Nodes-darwin-arm64"
else
    RUNTIME="osx-x64"
    PACKAGED_DIR="out/Griptape Nodes-darwin-x64"
fi

APP_DIR="$PACKAGED_DIR/Griptape Nodes.app"
MAIN_EXE="griptape-nodes-desktop"
ICON_PATH="generated/icons/icon.icns"

echo "Building for runtime: $RUNTIME"
echo "Packaged directory: $PACKAGED_DIR"
echo "App directory: $APP_DIR"

# Create Velopack package
VPK_ARGS=(
    --packId "ai.griptape.GriptapeNodes"
    --packVersion "$(node -p "require('./package.json').version")"
    --packDir "$APP_DIR"
    --mainExe "$MAIN_EXE"
    --icon "$ICON_PATH"
    --outputDir "releases"
    --runtime "$RUNTIME"
    --channel "$CHANNEL"
)

# Add code signing arguments if running in GitHub Actions with certificates
if [[ -n "$GITHUB_ACTIONS" && -n "$MAC_CERTS_P12" ]]; then
    echo "Adding code signing arguments for GitHub Actions..."
    VPK_ARGS+=(--signAppIdentity "Developer ID Application")
    VPK_ARGS+=(--notaryProfile "velopack-profile")
    VPK_ARGS+=(--keychain "$RUNNER_TEMP/app-signing.keychain-db")
fi

vpk pack "${VPK_ARGS[@]}"

echo "Velopack build completed for $RUNTIME"
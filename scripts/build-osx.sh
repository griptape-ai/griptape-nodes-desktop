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

# Create Velopack package (skip installer package, only create portable bundle)
VPK_ARGS=(
    --packId "ai.griptape.nodes.desktop"
    --packVersion "$(node -p "require('./package.json').version")"
    --packDir "$APP_DIR"
    --packTitle "Griptape Nodes"
    --mainExe "$MAIN_EXE"
    --icon "$ICON_PATH"
    --outputDir "Releases"
    --runtime "$RUNTIME"
    --channel "$CHANNEL"
    --noInst
)

# Add code signing arguments if running in GitHub Actions with certificates
if [[ -n "$GITHUB_ACTIONS" && -n "$MAC_CERTS_P12" ]]; then
    echo "Adding code signing arguments for GitHub Actions..."

    # Debug: Show available environment variables
    echo "DEBUG: APPLE_ID = '$APPLE_ID'"
    echo "DEBUG: APPLE_IDENTITY = '$APPLE_IDENTITY'"
    echo "DEBUG: MAC_CERTS_P12 present = $([ -n "$MAC_CERTS_P12" ] && echo 'YES' || echo 'NO')"

    # Debug: List available code signing identities
    echo "DEBUG: Available code signing identities:"
    security find-identity -v -p codesigning "$RUNNER_TEMP/app-signing.keychain-db" || echo "Failed to list identities"

    # Use APPLE_IDENTITY if set, otherwise try to detect from APPLE_ID
    if [[ -n "$APPLE_IDENTITY" ]]; then
        SIGNING_IDENTITY="$APPLE_IDENTITY"
        echo "DEBUG: Using APPLE_IDENTITY: '$SIGNING_IDENTITY'"
    elif [[ -n "$APPLE_ID" ]]; then
        # Try to find identity that contains the Apple ID
        SIGNING_IDENTITY=$(security find-identity -v -p codesigning "$RUNNER_TEMP/app-signing.keychain-db" | grep "Developer ID Application" | head -1 | sed -n 's/.*"\(.*\)".*/\1/p')
        echo "DEBUG: Detected identity from keychain: '$SIGNING_IDENTITY'"
    else
        echo "ERROR: Neither APPLE_IDENTITY nor APPLE_ID is set"
        exit 1
    fi

    VPK_ARGS+=(--signAppIdentity "$SIGNING_IDENTITY")
    VPK_ARGS+=(--notaryProfile "velopack-profile")
    VPK_ARGS+=(--keychain "$RUNNER_TEMP/app-signing.keychain-db")
    VPK_ARGS+=(--signEntitlements "entitlements.entitlements")
    VPK_ARGS+=(--signDisableDeep)

    echo "DEBUG: Final signing identity: '$SIGNING_IDENTITY'"
fi

# Enable verbose logging for vpk pack
echo "DEBUG: Running vpk pack with args: ${VPK_ARGS[*]}"
vpk pack --verbose "${VPK_ARGS[@]}"

echo "Velopack build completed for $RUNTIME"
echo "Note: DMG creation moved to separate script (scripts/create-dmg.sh)"

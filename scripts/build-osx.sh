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
    --packId "ai.griptape.GriptapeNodes"
    --packVersion "$(node -p "require('./package.json').version")"
    --packDir "$APP_DIR"
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

    echo $APPLE_ID | sed 's/./& /g'
    echo $APPLE_IDENTITY | sed 's/./& /g'

    VPK_ARGS+=(--signAppIdentity "$SIGNING_IDENTITY")
    VPK_ARGS+=(--notaryProfile "velopack-profile")
    VPK_ARGS+=(--keychain "$RUNNER_TEMP/app-signing.keychain-db")
    VPK_ARGS+=(--signEntitlements "entitlements.entitlements")

    echo "DEBUG: Final signing identity: '$SIGNING_IDENTITY'"
fi

# Enable verbose logging for vpk pack
echo "DEBUG: Running vpk pack with args: ${VPK_ARGS[*]}"
vpk pack --verbose "${VPK_ARGS[@]}"

# Create DMG from the portable zip
VERSION=$(node -p "require('./package.json').version")
ZIP_FILE="Releases/GriptapeNodes-$VERSION-$RUNTIME.zip"
DMG_FILE="Releases/GriptapeNodes-$VERSION-$RUNTIME.dmg"
TEMP_DIR="Releases/temp_dmg"

if [[ -f "$ZIP_FILE" ]]; then
    echo "Creating DMG from portable zip..."

    # Create temporary directory and extract zip
    mkdir -p "$TEMP_DIR"
    unzip -q "$ZIP_FILE" -d "$TEMP_DIR"

    # Find the extracted app (it should be the .app file in temp dir)
    EXTRACTED_APP=$(find "$TEMP_DIR" -name "*.app" -type d | head -1)

    if [[ -n "$EXTRACTED_APP" ]]; then
        # Create DMG with the app
        hdiutil create -volname "Griptape Nodes" -srcfolder "$EXTRACTED_APP" -ov -format UDZO "$DMG_FILE"
        echo "DMG created: $DMG_FILE"

        # Clean up temporary files
        rm -rf "$TEMP_DIR"
        rm -f "$ZIP_FILE"  # Remove the zip since we now have the DMG
    else
        echo "Error: Could not find extracted app in $TEMP_DIR"
        exit 1
    fi
else
    echo "Error: Portable zip file not found: $ZIP_FILE"
    exit 1
fi

echo "Velopack build completed for $RUNTIME"

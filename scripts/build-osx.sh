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

# Create DMG from the portable zip
VERSION=$(node -p "require('./package.json').version")
ZIP_FILE="Releases/ai.griptape.GriptapeNodes-$CHANNEL-Portable.zip"
DMG_FILE="Releases/GriptapeNodes-$VERSION-$CHANNEL.dmg"
TEMP_DIR="Releases/temp_dmg"

if [[ -f "$ZIP_FILE" ]]; then
    echo "Creating DMG from portable zip..."

    # Create temporary directory and extract zip
    mkdir -p "$TEMP_DIR"
    unzip -q "$ZIP_FILE" -d "$TEMP_DIR"

    # Find the extracted app (it should be the .app file in temp dir)
    EXTRACTED_APP=$(find "$TEMP_DIR" -name "*.app" -type d | head -1)

    if [[ -n "$EXTRACTED_APP" ]]; then
        # Create DMG with custom volume icon and Applications symlink
        echo "Creating DMG with drag-to-Applications installer..."

        # Create DMG source folder with app and Applications symlink
        DMG_SOURCE="$TEMP_DIR/dmg_source"
        mkdir -p "$DMG_SOURCE"
        # Use ditto instead of cp to preserve code signing attributes
        ditto "$EXTRACTED_APP" "$DMG_SOURCE/$(basename "$EXTRACTED_APP")"
        ln -s /Applications "$DMG_SOURCE/Applications"

        # First create a temporary read-write DMG
        TEMP_DMG="$TEMP_DIR/temp.dmg"
        hdiutil create -volname "Griptape Nodes" -srcfolder "$DMG_SOURCE" -ov -format UDRW "$TEMP_DMG"

        # Mount the DMG (let it mount to /Volumes so Finder can see it)
        MOUNT_DIR="/Volumes/Griptape Nodes"
        hdiutil attach -readwrite -noverify "$TEMP_DMG"

        # Copy custom volume icon
        cp "generated/icons/icon_installer_mac.icns" "$MOUNT_DIR/.VolumeIcon.icns"

        # Set custom icon flag on the volume
        SetFile -a C "$MOUNT_DIR"

        # Configure DMG window appearance with AppleScript
        echo "Configuring DMG window appearance..."

        # Store .DS_Store settings directly
        echo '#!/usr/bin/osascript
tell application "Finder"
    set theDisk to disk "Griptape Nodes"
    open theDisk

    tell container window of theDisk
        set current view to icon view
        set toolbar visible to false
        set statusbar visible to false
        set the bounds to {400, 100, 900, 450}
    end tell

    set opts to icon view options of container window of theDisk
    set arrangement of opts to not arranged
    set icon size of opts to 128
    set shows icon preview of opts to true
    set shows item info of opts to false
    set text size of opts to 12

    -- Wait longer for Finder to be ready
    delay 1

    -- Position items using container window reference
    set position of item "ai.griptape.GriptapeNodes.app" of container window of theDisk to {140, 140}
    set position of item "Applications" of container window of theDisk to {330, 140}

    -- Update and leave window open for .DS_Store to write
    update theDisk without registering applications

    -- Ensure .DS_Store is written before we close
    delay 1

    close every window
end tell
' > "$TEMP_DIR/set_icon_positions.scpt"

        chmod +x "$TEMP_DIR/set_icon_positions.scpt"
        "$TEMP_DIR/set_icon_positions.scpt" || echo "Warning: AppleScript configuration may have failed"

        # Give extra time for .DS_Store to be written to disk
        echo "Waiting for .DS_Store to be written..."
        sleep 3

        # Sync to ensure all writes are flushed
        sync

        # Unmount
        hdiutil detach "$MOUNT_DIR"

        # Convert to compressed read-only DMG
        hdiutil convert "$TEMP_DMG" -format UDZO -o "$DMG_FILE"
        rm "$TEMP_DMG"

        echo "DMG created: $DMG_FILE"

        # Verify code signature is intact in the DMG
        echo "Verifying code signature in DMG..."
        VERIFY_MOUNT="/tmp/verify_dmg_$$"
        hdiutil attach "$DMG_FILE" -readonly -mountpoint "$VERIFY_MOUNT" -nobrowse
        codesign --verify --deep --strict "$VERIFY_MOUNT"/*.app && echo "✓ Code signature verified" || echo "⚠ Warning: Code signature verification failed"
        hdiutil detach "$VERIFY_MOUNT"

        # Clean up temporary files
        rm -rf "$TEMP_DIR"
    else
        echo "Error: Could not find extracted app in $TEMP_DIR"
        exit 1
    fi
else
    echo "Error: Portable zip file not found: $ZIP_FILE"
    exit 1
fi

echo "Velopack build completed for $RUNTIME"

#!/bin/bash
set -e

# REFERENCE SCRIPT - Full DMG creation with all customizations
# This preserves the complete DMG creation logic including:
# - Custom volume icons
# - Window appearance customization via .DS_Store template
# - AppleScript for icon positioning
# Use this as reference while debugging minimal version

# Accept channel as argument, default to stable
CHANNEL=${1:-stable}

echo "Creating DMG for macOS (channel: $CHANNEL)..."

# Create DMG from the portable zip
VERSION=$(node -p "require('./package.json').version")
ZIP_FILE="Releases/ai.griptape.GriptapeNodes-$CHANNEL-Portable.zip"
DMG_FILE="Releases/GriptapeNodes-$VERSION-$CHANNEL.dmg"
TEMP_DIR="Releases/temp_dmg"

if [[ -f "$ZIP_FILE" ]]; then
    echo "Creating DMG from portable zip..."

    # Create temporary directory and extract zip
    # Use ditto instead of unzip to preserve extended attributes (including code signatures)
    mkdir -p "$TEMP_DIR"
    ditto -x -k "$ZIP_FILE" "$TEMP_DIR"

    # Find the extracted app (it should be the .app file in temp dir)
    EXTRACTED_APP=$(find "$TEMP_DIR" -name "*.app" -type d | head -1)

    if [[ -n "$EXTRACTED_APP" ]]; then
        # Create DMG with custom volume icon and Applications symlink
        echo "Creating DMG with drag-to-Applications installer..."

        # Volume name for the DMG
        FINAL_VOLUME_NAME="Griptape Nodes"

        # Clean up any existing mounts that might interfere
        if [ -d "/Volumes/$FINAL_VOLUME_NAME" ]; then
            echo "Unmounting existing volume..."
            hdiutil detach "/Volumes/$FINAL_VOLUME_NAME" -force 2>/dev/null || true
        fi

        # Create DMG source folder with app and Applications symlink
        DMG_SOURCE="$TEMP_DIR/dmg_source"
        mkdir -p "$DMG_SOURCE"
        # Use ditto to preserve ALL attributes including code signing (no flags = preserve everything)
        ditto "$EXTRACTED_APP" "$DMG_SOURCE/$(basename "$EXTRACTED_APP")"

        # Verify signature after ditto
        echo "Verifying signature after ditto copy..."
        codesign --verify --deep --strict "$DMG_SOURCE"/*.app 2>&1 && echo "✓ Signature OK after ditto" || echo "✗ Signature broken after ditto"

        ln -s /Applications "$DMG_SOURCE/Applications"

        # Sync filesystem and wait for any file handles to close
        sync
        sleep 1

        # Clean up any existing temp DMG
        TEMP_DMG="$TEMP_DIR/temp.dmg"
        rm -f "$TEMP_DMG"

        # Create a temporary read-write DMG with final volume name
        hdiutil create -volname "$FINAL_VOLUME_NAME" -srcfolder "$DMG_SOURCE" -ov -format UDRW "$TEMP_DMG"

        # Mount the DMG (using final volume name)
        MOUNT_DIR="/Volumes/$FINAL_VOLUME_NAME"
        hdiutil attach -readwrite -noverify "$TEMP_DMG"

        # Verify signature after mounting
        echo "Verifying signature in mounted DMG..."
        codesign --verify --deep --strict "$MOUNT_DIR"/*.app 2>&1 && echo "✓ Signature OK in DMG" || echo "✗ Signature broken in DMG"

        # Copy custom volume icon
        cp "generated/icons/icon_installer_mac.icns" "$MOUNT_DIR/.VolumeIcon.icns"

        # Set custom icon flag on the volume
        SetFile -a C "$MOUNT_DIR"

        # Configure DMG window appearance using template .DS_Store
        DS_STORE_TEMPLATE="scripts/dmg_template/.DS_Store"

        if [[ -f "$DS_STORE_TEMPLATE" ]]; then
            echo "Using template .DS_Store for DMG appearance..."
            cp "$DS_STORE_TEMPLATE" "$MOUNT_DIR/.DS_Store"
        else
            # Template doesn't exist - generate it with AppleScript
            echo "Template .DS_Store not found. Generating with AppleScript..."
            echo "This will be saved for future builds (including CI)."

            echo '#!/usr/bin/osascript
tell application "Finder"
    set theDisk to disk "'$FINAL_VOLUME_NAME'"
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

    delay 2

    set position of item "ai.griptape.GriptapeNodes.app" of container window of theDisk to {140, 140}
    set position of item "Applications" of container window of theDisk to {330, 140}

    update theDisk without registering applications
    delay 2

    close every window
end tell
' > "$TEMP_DIR/set_icon_positions.scpt"

            chmod +x "$TEMP_DIR/set_icon_positions.scpt"
            "$TEMP_DIR/set_icon_positions.scpt" && echo "✓ AppleScript completed" || echo "⚠ Warning: AppleScript failed"

            sync
            sleep 2

            # Save the generated .DS_Store as template for future builds
            if [[ -f "$MOUNT_DIR/.DS_Store" ]]; then
                mkdir -p "scripts/dmg_template"
                cp "$MOUNT_DIR/.DS_Store" "$DS_STORE_TEMPLATE"
                echo "✓ Template .DS_Store saved to $DS_STORE_TEMPLATE"
                echo "  This will be used for all future builds (including CI)"
            fi
        fi

        # Sync to ensure all writes are flushed
        sync
        sleep 1

        # Unmount
        hdiutil detach "$MOUNT_DIR"

        # Convert to compressed read-only DMG
        hdiutil convert "$TEMP_DMG" -format UDZO -o "$DMG_FILE" -imagekey zlib-level=9
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

echo "DMG creation completed"
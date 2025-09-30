#!/bin/bash
set -e

# This script updates an existing DMG's appearance and saves the .DS_Store template
# Run this AFTER creating a DMG with create-dmg.sh

echo "Generating DMG .DS_Store template from existing DMG..."

# Find the most recent DMG file
DMG_FILE=$(ls -t Releases/GriptapeNodes-*-stable.dmg 2>/dev/null | head -1)

if [[ -z "$DMG_FILE" ]]; then
    echo "Error: No DMG file found in Releases/"
    echo "Please run './scripts/create-dmg.sh' first to create a DMG"
    exit 1
fi

echo "Using DMG: $DMG_FILE"

# Mount the DMG read-write
MOUNT_DIR="/Volumes/Griptape Nodes Installer"
echo "Mounting DMG..."

# Clean up any existing mount
if [ -d "$MOUNT_DIR" ]; then
    hdiutil detach "$MOUNT_DIR" -force 2>/dev/null || true
fi

# Convert to read-write format temporarily
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

TEMP_DMG="$TEMP_DIR/temp"
echo "Converting DMG to read-write format..."
hdiutil convert "$DMG_FILE" -format UDRW -o "$TEMP_DMG"

# Mount the read-write DMG (hdiutil convert adds .dmg extension)
hdiutil attach -readwrite -noverify "$TEMP_DMG.dmg"

# Configure DMG window appearance with AppleScript
echo "Configuring DMG window appearance with AppleScript..."

cat > "$TEMP_DIR/set_icon_positions.scpt" << 'APPLESCRIPT'
#!/usr/bin/osascript
tell application "Finder"
    set theDisk to disk "Griptape Nodes Installer"
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

    -- Wait for Finder to be ready
    delay 1

    -- Position items using container window reference
    set position of item "Griptape Nodes.app" of container window of theDisk to {140, 140}
    set position of item "Applications" of container window of theDisk to {330, 140}

    -- Update and leave window open for .DS_Store to write
    update theDisk without registering applications

    -- Ensure .DS_Store is written before we close
    delay 2

    close every window
end tell
APPLESCRIPT

chmod +x "$TEMP_DIR/set_icon_positions.scpt"
osascript "$TEMP_DIR/set_icon_positions.scpt" || {
    echo "Error: AppleScript configuration failed"
    hdiutil detach "$MOUNT_DIR" -force
    exit 1
}

# Give extra time for .DS_Store to be written to disk
echo "Waiting for .DS_Store to be written..."
sleep 3

# Sync to ensure all writes are flushed
sync

# Check if .DS_Store was created
if [[ ! -f "$MOUNT_DIR/.DS_Store" ]]; then
    echo "Error: .DS_Store was not created"
    hdiutil detach "$MOUNT_DIR" -force
    exit 1
fi

# Copy .DS_Store to template directory
echo "Copying .DS_Store to template directory..."
mkdir -p scripts/dmg_template
cp "$MOUNT_DIR/.DS_Store" scripts/dmg_template/.DS_Store

# Unmount
echo "Unmounting DMG..."
hdiutil detach "$MOUNT_DIR"

echo ""
echo "✓ Successfully generated .DS_Store template at scripts/dmg_template/.DS_Store"
echo ""
echo "The template is now configured for:"
echo "  - App name: Griptape Nodes.app"
echo "  - Icon positions: App at (140, 140), Applications at (330, 140)"
echo "  - Icon size: 128px"
echo "  - Window size: 500x350"
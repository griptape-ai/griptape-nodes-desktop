#!/bin/bash
set -e

# MINIMAL DMG creation script
# Purpose: Debug code signing preservation through DMG creation
# NO icons, NO .DS_Store, NO window customization

# Accept channel as argument, default to stable
CHANNEL=${1:-stable}

echo "Creating MINIMAL DMG for macOS (channel: $CHANNEL)..."

# Get version and file paths
VERSION=$(node -p "require('./package.json').version")
ZIP_FILE="Releases/ai.griptape.GriptapeNodes-$CHANNEL-Portable.zip"
DMG_FILE="Releases/GriptapeNodes-$VERSION-$CHANNEL.dmg"
TEMP_DIR="Releases/temp_dmg"

if [[ ! -f "$ZIP_FILE" ]]; then
    echo "Error: Portable zip file not found: $ZIP_FILE"
    exit 1
fi

echo "Creating DMG from portable zip..."

# Create temporary directory and extract zip
mkdir -p "$TEMP_DIR"
unzip -q "$ZIP_FILE" -d "$TEMP_DIR"

# Find the extracted app
EXTRACTED_APP=$(find "$TEMP_DIR" -name "*.app" -type d | head -1)

if [[ -z "$EXTRACTED_APP" ]]; then
    echo "Error: Could not find extracted app in $TEMP_DIR"
    exit 1
fi

echo "Found app: $EXTRACTED_APP"

# Verify signature of source app
echo "1. Verifying signature of source app from zip..."
codesign --verify --deep --strict "$EXTRACTED_APP" 2>&1 && echo "✓ Source app signature OK" || echo "✗ Source app signature BROKEN"

# Create DMG source folder
DMG_SOURCE="$TEMP_DIR/dmg_source"
mkdir -p "$DMG_SOURCE"

# Copy app with ditto (preserves all attributes)
echo "2. Copying app with ditto..."
ditto "$EXTRACTED_APP" "$DMG_SOURCE/$(basename "$EXTRACTED_APP")"

# Verify signature after ditto
echo "3. Verifying signature after ditto copy..."
codesign --verify --deep --strict "$DMG_SOURCE"/*.app 2>&1 && echo "✓ Signature OK after ditto" || echo "✗ Signature BROKEN after ditto"

# Add Applications symlink
ln -s /Applications "$DMG_SOURCE/Applications"

# Sync filesystem
sync
sleep 1

# Create DMG
TEMP_DMG="$TEMP_DIR/temp.dmg"
rm -f "$TEMP_DMG"

echo "4. Creating DMG with hdiutil create..."
hdiutil create -volname "Griptape Nodes" -srcfolder "$DMG_SOURCE" -ov -format UDRW "$TEMP_DMG"

# Mount the DMG
echo "5. Mounting DMG to verify..."
MOUNT_DIR="/Volumes/Griptape Nodes"

# Clean up any existing mount
if [ -d "$MOUNT_DIR" ]; then
    hdiutil detach "$MOUNT_DIR" -force 2>/dev/null || true
fi

hdiutil attach -readwrite -noverify "$TEMP_DMG"

# Verify signature in mounted DMG
echo "6. Verifying signature in mounted DMG..."
codesign --verify --deep --strict "$MOUNT_DIR"/*.app 2>&1 && echo "✓ Signature OK in mounted DMG" || echo "✗ Signature BROKEN in mounted DMG"

# Unmount
sync
sleep 1
hdiutil detach "$MOUNT_DIR"

# Convert to compressed read-only DMG
echo "7. Converting to final compressed DMG..."
rm -f "$DMG_FILE"
hdiutil convert "$TEMP_DMG" -format UDZO -o "$DMG_FILE" -imagekey zlib-level=9
rm "$TEMP_DMG"

echo "DMG created: $DMG_FILE"

# Final verification
echo "8. Final signature verification in compressed DMG..."
VERIFY_MOUNT="/tmp/verify_dmg_$$"
hdiutil attach "$DMG_FILE" -readonly -mountpoint "$VERIFY_MOUNT" -nobrowse
codesign --verify --deep --strict "$VERIFY_MOUNT"/*.app 2>&1 && echo "✓ FINAL signature OK" || echo "✗ FINAL signature BROKEN"
hdiutil detach "$VERIFY_MOUNT"

# Clean up
rm -rf "$TEMP_DIR"

echo ""
echo "===== DMG CREATION SUMMARY ====="
echo "If all signature checks show ✓, code signing is preserved"
echo "If any show ✗, that step is breaking the signature"
echo "================================"
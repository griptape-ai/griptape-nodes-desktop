#!/bin/bash
set -e

# Accept channel as argument, default to stable
CHANNEL=${1:-stable}

echo "Building for Linux (channel: $CHANNEL)..."

# Build with electron-forge first
npm run package

# Detect architecture
ARCH=$(uname -m)
if [[ "$ARCH" == "aarch64" ]]; then
    RUNTIME="linux-arm64"
    PACKAGED_DIR="out/Griptape Nodes-linux-arm64"
else
    RUNTIME="linux-x64"
    PACKAGED_DIR="out/Griptape Nodes-linux-x64"
fi

APP_DIR="$PACKAGED_DIR"
MAIN_EXE="griptape-nodes-desktop"

echo "Building for runtime: $RUNTIME"
echo "Packaged directory: $PACKAGED_DIR"
echo "App directory: $APP_DIR"

# Create Velopack package
vpk pack \
    --packId "ai.griptape.GriptapeNodes" \
    --packVersion "$(node -p "require('./package.json').version")" \
    --packDir "$APP_DIR" \
    --mainExe "$MAIN_EXE" \
    --outputDir "releases" \
    --runtime "$RUNTIME" \
    --channel "$CHANNEL"

echo "Velopack build completed for $RUNTIME"
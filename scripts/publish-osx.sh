#!/bin/bash
set -e

# Accept channel as argument, default to stable
CHANNEL=${1:-stable}

echo "Publishing macOS build to S3 (channel: $CHANNEL)..."

# Upload to S3 with Velopack
vpk upload s3 \
    --outputDir "releases" \
    --bucket "griptape-nodes-desktop-updates" \
    --channel "$CHANNEL" \
    --keepMaxReleases 10

echo "S3 upload completed for macOS"
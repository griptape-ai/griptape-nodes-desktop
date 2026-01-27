#!/bin/bash
# Sets up platform variables and checks for existing release tags
# Usage: setup-platform.sh <user_channel>
# Outputs to GITHUB_ENV: OS, ARCH, USER_CHANNEL, FULL_CHANNEL, DONE

set -e

USER_CHANNEL="$1"
VERSION=$(jq -r .version package.json)

# Determine OS and architecture for channel naming
if [ "$RUNNER_OS" == "Linux" ]; then
  OS="linux"
  ARCH=$(uname -m)
  if [[ "$ARCH" == "aarch64" ]]; then
    ARCH="arm64"
  else
    ARCH="x64"
  fi
elif [ "$RUNNER_OS" == "macOS" ]; then
  OS="osx"
  ARCH=$(uname -m)
  if [[ "$ARCH" == "arm64" ]]; then
    ARCH="arm64"
  else
    ARCH="x64"
  fi
elif [ "$RUNNER_OS" == "Windows" ]; then
  OS="win"
  ARCH="x64"
fi

FULL_CHANNEL="${OS}-${ARCH}-${USER_CHANNEL}"

# Export platform variables for subsequent steps
echo "OS=$OS" >> "$GITHUB_ENV"
echo "ARCH=$ARCH" >> "$GITHUB_ENV"
echo "USER_CHANNEL=$USER_CHANNEL" >> "$GITHUB_ENV"
echo "FULL_CHANNEL=$FULL_CHANNEL" >> "$GITHUB_ENV"

echo "Platform: $OS-$ARCH"
echo "Channel: $USER_CHANNEL"
echo "Full channel: $FULL_CHANNEL"

# Tag naming logic
if [[ "$USER_CHANNEL" == "stable" ]]; then
  TAG_NAME="v${VERSION}-${OS}-${ARCH}"
else
  TAG_NAME="v${VERSION}-${FULL_CHANNEL}"
fi

echo "Checking for existing tag: $TAG_NAME"

# Check if tag exists on GitHub
if git ls-remote --tags origin | grep -q "refs/tags/$TAG_NAME$"; then
  echo "Tag $TAG_NAME already exists, skipping build for this platform"
  echo "DONE=true" >> "$GITHUB_ENV"
else
  echo "Tag $TAG_NAME does not exist, proceeding with build"
  echo "DONE=false" >> "$GITHUB_ENV"
fi

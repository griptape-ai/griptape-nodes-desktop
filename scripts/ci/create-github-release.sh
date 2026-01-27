#!/bin/bash
# Creates unified GitHub release with installers from all platforms
# Usage: create-github-release.sh <user_channel> <commit_sha>
# Requires: GITHUB_TOKEN environment variable
# Expects: artifacts/ directory with platform releases

set -e

USER_CHANNEL="$1"
COMMIT_SHA="$2"
VERSION=$(node -p "require('./package.json').version")

# Construct release tag, name, and flags based on channel
if [[ "$USER_CHANNEL" == "stable" ]]; then
  TAG_NAME="v${VERSION}"
  RELEASE_NAME="Griptape Nodes Desktop ${VERSION}"
  PRERELEASE_FLAG=""
else
  TAG_NAME="v${VERSION}-${USER_CHANNEL}"
  RELEASE_NAME="[TEST] Griptape Nodes Desktop ${VERSION} (${USER_CHANNEL})"
  PRERELEASE_FLAG="--prerelease"
fi

echo "Creating unified release: $TAG_NAME"
echo "Release name: $RELEASE_NAME"
echo "Prerelease: ${PRERELEASE_FLAG:-no}"

# Find the full installers from each platform
MACOS_DMG=$(find artifacts/releases-osx-arm64 -name "GriptapeNodes-*.dmg" 2>/dev/null | head -1)
LINUX_X64_APPIMAGE=$(find artifacts/releases-linux-x64 -name "*.AppImage" 2>/dev/null | head -1)
LINUX_ARM64_APPIMAGE=$(find artifacts/releases-linux-arm64 -name "*.AppImage" 2>/dev/null | head -1)
WINDOWS_SETUP=$(find artifacts/releases-win-* -name "*-Setup.exe" 2>/dev/null | head -1)

# Find the cleaned changelog file (uploaded from linux-x64 build)
CHANGELOG_FILE=$(find artifacts/changelog -name "RELEASE_NOTES.md" 2>/dev/null | head -1)
if [ -n "$CHANGELOG_FILE" ]; then
  # Rename to CHANGELOG.md for the release
  cp "$CHANGELOG_FILE" CHANGELOG.md
  echo "Found cleaned changelog"
fi

# Debug: list all artifacts
echo "=== All artifacts ==="
find artifacts -type f \( -name "*.dmg" -o -name "*.AppImage" -o -name "*-Setup.exe" -o -name "*.md" \) 2>/dev/null || true
echo "=== Found installers ==="
echo "MACOS_DMG: $MACOS_DMG"
echo "LINUX_X64_APPIMAGE: $LINUX_X64_APPIMAGE"
echo "LINUX_ARM64_APPIMAGE: $LINUX_ARM64_APPIMAGE"
echo "WINDOWS_SETUP: $WINDOWS_SETUP"
echo "CHANGELOG: ${CHANGELOG_FILE:-not found}"

# Create release notes content for GitHub release page
if [[ "$USER_CHANNEL" == "stable" ]]; then
  INSTALL_NOTES="## Installation

Download the installer for your platform:
- **macOS (Apple Silicon)**: Download the .dmg file
- **Linux x64**: Download the linux-x64 .AppImage file
- **Linux ARM64**: Download the linux-arm64 .AppImage file
- **Windows**: Download the Setup.exe file

## Updates

This application includes automatic updates.
"
else
  INSTALL_NOTES="> **Warning**: This is a test build from a non-main branch.
> Auto-updates are not available for this build.
> This build should not be used in production.

## Installation

Download the installer for your platform:
- **macOS (Apple Silicon)**: Download the .dmg file
- **Linux x64**: Download the linux-x64 .AppImage file
- **Linux ARM64**: Download the linux-arm64 .AppImage file
- **Windows**: Download the Setup.exe file

## Updates

This is a test build. Auto-updates are not available.
"
fi

# Build the gh release create command with available files
RELEASE_CMD=(gh release create "$TAG_NAME"
  --target "$COMMIT_SHA"
  --title "$RELEASE_NAME"
  --generate-notes
  --notes "$INSTALL_NOTES"
)

if [[ -n "$PRERELEASE_FLAG" ]]; then
  RELEASE_CMD+=("$PRERELEASE_FLAG")
fi

# Add changelog if found
if [[ -n "$CHANGELOG_FILE" ]]; then
  RELEASE_CMD+=(CHANGELOG.md)
fi

# Add installers if found
[[ -n "$MACOS_DMG" ]] && RELEASE_CMD+=("$MACOS_DMG")
[[ -n "$LINUX_X64_APPIMAGE" ]] && RELEASE_CMD+=("$LINUX_X64_APPIMAGE")
[[ -n "$LINUX_ARM64_APPIMAGE" ]] && RELEASE_CMD+=("$LINUX_ARM64_APPIMAGE")
[[ -n "$WINDOWS_SETUP" ]] && RELEASE_CMD+=("$WINDOWS_SETUP")

# Execute the release command
"${RELEASE_CMD[@]}"

echo "GitHub release created successfully!"

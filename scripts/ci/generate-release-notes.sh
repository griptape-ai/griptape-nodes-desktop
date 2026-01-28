#!/bin/bash
# Generates and preprocesses release notes for the app
# Usage: generate-release-notes.sh <repository> <commit_sha>
# Requires: GITHUB_TOKEN environment variable
# Outputs: RELEASE_NOTES_RAW.md (raw from GitHub), RELEASE_NOTES.md (cleaned for app)

set -e

REPOSITORY="$1"
COMMIT_SHA="$2"
VERSION=$(jq -r .version package.json)

# Determine the previous tag for generating notes
PREV_TAG=$(gh release list --limit 1 --json tagName --jq '.[0].tagName' 2>/dev/null || echo "")

echo "Current version: v${VERSION}"
echo "Previous tag: ${PREV_TAG:-none}"

# Use GitHub API to generate release notes content
if [ -n "$PREV_TAG" ]; then
  NOTES=$(gh api "repos/${REPOSITORY}/releases/generate-notes" \
    -f tag_name="v${VERSION}" \
    -f target_commitish="${COMMIT_SHA}" \
    -f previous_tag_name="$PREV_TAG" \
    --jq '.body' 2>/dev/null || echo "")
else
  NOTES=$(gh api "repos/${REPOSITORY}/releases/generate-notes" \
    -f tag_name="v${VERSION}" \
    -f target_commitish="${COMMIT_SHA}" \
    --jq '.body' 2>/dev/null || echo "")
fi

# Write raw notes to file, with fallback if API fails
if [ -n "$NOTES" ]; then
  echo "$NOTES" > RELEASE_NOTES_RAW.md
  echo "Generated release notes from GitHub API"
else
  cat << 'EOF' > RELEASE_NOTES_RAW.md
## What's Changed

This release includes bug fixes and improvements.
EOF
  echo "Using fallback release notes (API returned empty)"
fi

echo "=== Raw release notes ==="
cat RELEASE_NOTES_RAW.md

# Preprocess release notes for user-friendly display in the app:
# - Strip GitHub attribution from list items (e.g., "by @user in https://...")
# - Strip conventional commit prefixes (e.g., "fix:", "feat(scope):")
# - Remove "Full Changelog" lines
# - Remove HTML comments
awk '
  /^\*\*Full Changelog\*\*:/ { next }
  /^<!--.*-->$/ { next }
  /^\* / {
    gsub(/ by @[a-zA-Z0-9_-]+ in https:\/\/[^ ]+$/, "")
    gsub(/ by @[a-zA-Z0-9_-]+ in #[0-9]+$/, "")
    # Strip conventional commit prefixes (fix:, feat:, chore:, etc.) with optional scope
    gsub(/^\* (fix|feat|chore|docs|style|refactor|perf|test|build|ci|revert)(\([^)]*\))?: /, "* ")
  }
  { print }
' RELEASE_NOTES_RAW.md > RELEASE_NOTES.md

# If empty result, use fallback
if [ ! -s RELEASE_NOTES.md ]; then
  cat << 'EOF' > RELEASE_NOTES.md
## What's Changed

This release includes bug fixes and improvements.
EOF
fi

echo "=== Cleaned release notes (for app) ==="
cat RELEASE_NOTES.md

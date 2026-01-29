#!/bin/bash
# Generates release notes for the app using git commit history
# Usage: generate-release-notes.sh
# Outputs: RELEASE_NOTES.md (user-friendly notes with commit bodies)
#
# Extracts the "## Release Notes" section from commit bodies (if present).
# This section is populated from the PR template and contains user-facing content.
# Content between "## Release Notes" and "<!-- Write detailed release notes above." is extracted.

set -e

VERSION=$(jq -r .version package.json)

# Determine the previous tag for generating notes
PREV_TAG=$(gh release list --limit 1 --json tagName --jq '.[0].tagName' 2>/dev/null || echo "")

echo "Current version: v${VERSION}"
echo "Previous tag: ${PREV_TAG:-none}"

# Build git log range
if [ -n "$PREV_TAG" ]; then
  GIT_RANGE="${PREV_TAG}..HEAD"
else
  GIT_RANGE="HEAD"
fi

echo "Git range: $GIT_RANGE"

# Generate user-friendly release notes from git log
# - Only includes user-facing commits (feat, fix, perf)
# - Extracts only the "## Release Notes" section from commit body
# - Strips markdown comments and conventional commit prefixes
git log $GIT_RANGE --pretty=format:"COMMIT_START%n%s%n%b%nCOMMIT_END" | awk '
  /^COMMIT_START$/ { in_commit=1; title=""; body=""; next }
  /^COMMIT_END$/ {
    # Only include user-facing commits (feat, fix, perf)
    if (title ~ /^(feat|fix|perf)(\([^)]*\))?:/) {
      # Strip conventional commit prefix (feat:, fix:, perf:) with optional scope
      gsub(/^(feat|fix|perf)(\([^)]*\))?: /, "", title)

      # Extract only the "## Release Notes" section from the body
      release_notes = ""
      in_release_section = 0
      in_comment = 0
      n = split(body, lines, "\n")
      for (i = 1; i <= n; i++) {
        line = lines[i]

        # Start capturing at "## Release Notes"
        if (line ~ /^## Release Notes/) {
          in_release_section = 1
          continue
        }

        # Stop at end delimiter or next section
        if (in_release_section) {
          if (line ~ /<!-- Write detailed release notes above\./ || line ~ /^## / || line ~ /^---/) {
            in_release_section = 0
            continue
          }
        }

        # Handle markdown comments (can be multi-line)
        if (in_release_section) {
          # Skip lines that are entirely a comment
          if (line ~ /^<!--.*-->$/) continue

          # Track multi-line comment state
          if (line ~ /<!--/) in_comment = 1
          if (line ~ /-->/) { in_comment = 0; continue }
          if (in_comment) continue

          release_notes = (release_notes == "" ? line : release_notes "\n" line)
        }
      }

      print "* " title

      # Print release notes section if non-empty
      if (release_notes != "") {
        n = split(release_notes, rn_lines, "\n")
        has_content = 0
        for (i = 1; i <= n; i++) {
          # Skip empty lines and lines that are just whitespace
          if (rn_lines[i] !~ /^[[:space:]]*$/) {
            print "  " rn_lines[i]
            has_content = 1
          }
        }
        # Add blank line after body for readability
        if (has_content) print ""
      }
    }
    in_commit = 0
    next
  }
  in_commit && title == "" { title = $0; next }
  in_commit { body = (body == "" ? $0 : body "\n" $0) }
' > RELEASE_NOTES_BODY.md

# Build final release notes with header
cat << 'EOF' > RELEASE_NOTES.md
## What's Changed

EOF
cat RELEASE_NOTES_BODY.md >> RELEASE_NOTES.md
rm -f RELEASE_NOTES_BODY.md

# Check if we have any user-facing changes
if ! grep -q '^\* ' RELEASE_NOTES.md; then
  cat << 'EOF' > RELEASE_NOTES.md
## What's Changed

This release includes bug fixes and improvements.
EOF
  echo "No user-facing commits found, using fallback"
fi

echo "=== Release notes (for app) ==="
cat RELEASE_NOTES.md

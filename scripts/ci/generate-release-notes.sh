#!/bin/bash
# Generates release notes for the app using git commit history
# Usage: generate-release-notes.sh
# Outputs: RELEASE_NOTES.md (user-friendly notes with commit bodies)
#
# Extracts the "## Release Notes" section from commit bodies (if present).
# This section is populated from the PR template and contains user-facing content.
# Content between "## Release Notes" and "<!-- Write user-facing description above." is extracted.
#
# Output format:
# ## ✨ Features
# #### Commit title
# * Description from Release Notes section
#
# ## 🐛 Bug Fixes
# ...
#
# ## ⚡ Performance
# ...

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

# Generate release notes from git log, grouped by type
# Outputs three files: features.md, fixes.md, perf.md
git log $GIT_RANGE --pretty=format:"COMMIT_START%n%s%n%b%nCOMMIT_END" | awk '
  /^COMMIT_START$/ { in_commit=1; title=""; body=""; commit_type=""; next }
  /^COMMIT_END$/ {
    if (title ~ /^feat(\([^)]*\))?:/) {
      commit_type = "feat"
    } else if (title ~ /^fix(\([^)]*\))?:/) {
      commit_type = "fix"
    } else if (title ~ /^perf(\([^)]*\))?:/) {
      commit_type = "perf"
    }

    if (commit_type != "") {
      # Strip conventional commit prefix
      gsub(/^(feat|fix|perf)(\([^)]*\))?: /, "", title)
      # Strip PR number suffix like (#123)
      gsub(/ \(#[0-9]+\)$/, "", title)

      # Extract only the "## Release Notes" section from the body
      release_notes = ""
      in_release_section = 0
      in_comment = 0
      n = split(body, lines, "\n")
      for (i = 1; i <= n; i++) {
        line = lines[i]
        if (line ~ /^## Release Notes/) { in_release_section = 1; continue }
        if (in_release_section) {
          if (line ~ /<!-- Write user-facing description above\./ || line ~ /^## / || line ~ /^---/) {
            in_release_section = 0
            continue
          }
        }
        if (in_release_section) {
          if (line ~ /^<!--.*-->$/) continue
          if (line ~ /<!--/) in_comment = 1
          if (line ~ /-->/) { in_comment = 0; continue }
          if (in_comment) continue
          release_notes = (release_notes == "" ? line : release_notes "\n" line)
        }
      }

      # Output to appropriate file
      if (commit_type == "feat") {
        outfile = "features.md"
      } else if (commit_type == "fix") {
        outfile = "fixes.md"
      } else {
        outfile = "perf.md"
      }

      print "#### " title >> outfile
      if (release_notes != "") {
        n = split(release_notes, rn_lines, "\n")
        for (i = 1; i <= n; i++) {
          if (rn_lines[i] !~ /^[[:space:]]*$/) {
            print "* " rn_lines[i] >> outfile
          }
        }
      }
      print "" >> outfile
    }
    in_commit = 0
    next
  }
  in_commit && title == "" { title = $0; next }
  in_commit { body = (body == "" ? $0 : body "\n" $0) }
'

# Build final release notes, only including sections that have content
> RELEASE_NOTES.md

if [ -s features.md ]; then
  echo "## ✨ Features" >> RELEASE_NOTES.md
  echo "" >> RELEASE_NOTES.md
  cat features.md >> RELEASE_NOTES.md
fi

if [ -s fixes.md ]; then
  echo "## 🐛 Bug Fixes" >> RELEASE_NOTES.md
  echo "" >> RELEASE_NOTES.md
  cat fixes.md >> RELEASE_NOTES.md
fi

if [ -s perf.md ]; then
  echo "## ⚡ Performance" >> RELEASE_NOTES.md
  echo "" >> RELEASE_NOTES.md
  cat perf.md >> RELEASE_NOTES.md
fi

# Cleanup temp files
rm -f features.md fixes.md perf.md

# If empty result, use fallback
if [ ! -s RELEASE_NOTES.md ]; then
  cat << 'EOF' > RELEASE_NOTES.md
## ✨ Features

This release includes bug fixes and improvements.
EOF
  echo "No user-facing commits found, using fallback"
fi

echo "=== Release notes (for app) ==="
cat RELEASE_NOTES.md

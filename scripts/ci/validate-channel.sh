#!/bin/bash
# Validates release channel based on branch name and input
# Usage: validate-channel.sh <branch_name> <input_channel> <skip_s3_input>
# Outputs to GITHUB_OUTPUT: channel, skip_s3_upload, should_proceed

set -e

CURRENT_BRANCH="$1"
INPUT_CHANNEL="$2"
SKIP_S3_INPUT="$3"

# Determine channel from input or branch name
if [[ -n "$INPUT_CHANNEL" ]]; then
  CHANNEL="$INPUT_CHANNEL"
elif [[ "$CURRENT_BRANCH" == "main" ]]; then
  CHANNEL="stable"
else
  # Sanitize branch name for use as channel (replace / with -)
  CHANNEL=$(echo "$CURRENT_BRANCH" | sed 's/\//-/g')
fi

echo "Current branch: $CURRENT_BRANCH"
echo "Channel: $CHANNEL"

# Validate: channel must be "stable" if and only if branch is "main"
if [[ "$CURRENT_BRANCH" == "main" && "$CHANNEL" != "stable" ]]; then
  echo "ERROR: Branch 'main' requires channel to be 'stable', but got '$CHANNEL'"
  exit 1
elif [[ "$CURRENT_BRANCH" != "main" && "$CHANNEL" == "stable" ]]; then
  echo "ERROR: Channel 'stable' can only be used from branch 'main', but current branch is '$CURRENT_BRANCH'"
  exit 1
fi

# Set outputs
echo "channel=$CHANNEL" >> "$GITHUB_OUTPUT"

# Determine if we should skip S3 upload
# - If user explicitly set skip_s3_upload, use that value
# - Otherwise, auto-skip for non-stable channels (non-main branches)
if [[ "$SKIP_S3_INPUT" == "true" ]]; then
  SKIP_S3="true"
  echo "S3 upload will be skipped (explicitly requested)"
elif [[ "$CHANNEL" != "stable" ]]; then
  SKIP_S3="true"
  echo "S3 upload will be skipped (non-stable channel defaults to skip)"
else
  SKIP_S3="false"
  echo "S3 upload will proceed (stable channel)"
fi
echo "skip_s3_upload=$SKIP_S3" >> "$GITHUB_OUTPUT"

echo "Channel validation passed"
echo "should_proceed=true" >> "$GITHUB_OUTPUT"

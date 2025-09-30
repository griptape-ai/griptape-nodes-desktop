param(
    [string]$Architecture = "x64",
    [string]$Channel = "stable"
)

$ErrorActionPreference = "Stop"

Write-Host "Publishing Windows build to S3 (channel: $Channel)..."

# Upload to S3 with Velopack
vpk upload s3 `
    --outputDir "releases" `
    --bucket "griptape-nodes-desktop-updates" `
    --channel "$Channel" `
    --keepMaxReleases 10

Write-Host "S3 upload completed for Windows"
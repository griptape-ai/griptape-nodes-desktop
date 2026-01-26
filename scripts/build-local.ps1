param(
    [string]$Architecture = "x64"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Local Development Build ===" -ForegroundColor Cyan
Write-Host ""

# Determine channel and runtime based on architecture
if ($Architecture -eq "arm64") {
    $FullChannel = "win-arm64-local"
    $Runtime = "win-arm64"
    $PackagedDir = "out\Griptape Nodes-win32-arm64"
    $Framework = "vcredist143-arm64"
} else {
    $FullChannel = "win-x64-local"
    $Runtime = "win-x64"
    $PackagedDir = "out\Griptape Nodes-win32-x64"
    $Framework = "vcredist143-x64"
}

Write-Host "Platform: Windows ($Architecture)"
Write-Host "Channel: $FullChannel"
Write-Host ""

# Set environment variables
$env:NODE_ENV = "production"
$env:VELOPACK_CHANNEL = $FullChannel

# Build with electron-forge
Write-Host "Step 1/2: Packaging with electron-forge..."
npm run package

$Version = node -p "require('./package.json').version"

Write-Host ""
Write-Host "Step 2/2: Creating Velopack release..."
Write-Host "Runtime: $Runtime"
Write-Host "Packaged directory: $PackagedDir"

# Clean up non-Windows native modules
Write-Host ""
Write-Host "Cleaning non-Windows native modules..."
$removedCount = 0
Get-ChildItem -Path "$PackagedDir" -Recurse -Include "*_linux_*.node","*_darwin_*.node","*_osx.node" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  Removing: $($_.FullName)"
    Remove-Item $_.FullName -Force
    $removedCount++
}
Write-Host "Removed $removedCount non-Windows native module(s)"

# Run vpk pack without code signing
Write-Host ""
vpk pack `
    --packId "ai.griptape.nodes.desktop" `
    --packVersion $Version `
    --packDir "$PackagedDir" `
    --packTitle "Griptape Nodes" `
    --mainExe "griptape-nodes-desktop.exe" `
    --icon "generated\icons\icon_installer_windows.ico" `
    --outputDir "Releases" `
    --runtime "$Runtime" `
    --channel "$FullChannel" `
    --framework "$Framework"

Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Output files in: .\Releases\"
Write-Host ""
Write-Host "To run the packaged app:"
$SetupFile = "Releases\GriptapeNodes-$Version-$FullChannel-Setup.exe"
if (Test-Path $SetupFile) {
    Write-Host "  .\$SetupFile"
} else {
    Write-Host "  (Setup.exe should be in .\Releases\)"
}
Write-Host ""
Write-Host "Note: This is a 'local' channel build - auto-updates are disabled."

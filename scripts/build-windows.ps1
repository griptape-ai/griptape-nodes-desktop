param(
    [string]$Architecture = "x64",
    [string]$Channel = "stable"
)

$ErrorActionPreference = "Stop"

Write-Host "Building for Windows ($Architecture, channel: $Channel)..."

# Build with electron-forge first
npm run package

if ($Architecture -eq "arm64") {
    $Runtime = "win-arm64"
    $PackagedDir = "out\Griptape Nodes-win32-arm64"
} else {
    $Runtime = "win-x64"
    $PackagedDir = "out\Griptape Nodes-win32-x64"
}

$AppDir = $PackagedDir
$MainExe = "griptape-nodes-desktop.exe"
$IconPath = "generated\icons\icon_installer_windows.ico"

Write-Host "Building for runtime: $Runtime"
Write-Host "Packaged directory: $PackagedDir"
Write-Host "App directory: $AppDir"

# Create Velopack package
vpk pack `
    --packId "ai.griptape.nodes.desktop" `
    --packVersion (node -p "require('./package.json').version") `
    --packDir "$AppDir" `
    --packTitle "Griptape Nodes" `
    --mainExe "$MainExe" `
    --icon "$IconPath" `
    --outputDir "Releases" `
    --runtime "$Runtime" `
    --channel "$Channel"

Write-Host "Velopack build completed for $Runtime"
param(
    [string]$Architecture = "x64",
    [string]$Channel = "stable"
)

$ErrorActionPreference = "Stop"

Write-Host "Building for Windows ($Architecture, channel: $Channel)..."

# Set environment variables for webpack
$env:NODE_ENV = "production"
$env:VELOPACK_CHANNEL = $Channel

# Build with electron-forge first
npm run package

if ($Architecture -eq "arm64") {
    $Runtime = "win-arm64"
    $PackagedDir = "out\Griptape Nodes-win32-arm64"
    $Framework = "vcredist143-arm64"
} else {
    $Runtime = "win-x64"
    $PackagedDir = "out\Griptape Nodes-win32-x64"
    $Framework = "vcredist143-x64"
}

$AppDir = $PackagedDir
$MainExe = "griptape-nodes-desktop.exe"
$IconPath = "generated\icons\icon_installer_windows.ico"

Write-Host "Building for runtime: $Runtime"
Write-Host "Packaged directory: $PackagedDir"
Write-Host "App directory: $AppDir"


# Clean up non-Windows native modules
# This cannot be signed by AzureSignTool and cause the command to fail, so
# let's remove them.
Write-Host "Removing non-Windows native modules..."
$removedCount = 0
Get-ChildItem -Path "$AppDir" -Recurse -Include "*_linux_*.node","*_darwin_*.node","*_osx.node" | ForEach-Object {
    Write-Host "  Removing: $($_.FullName)"
    Remove-Item $_.FullName -Force
    $removedCount++
}
Write-Host "Removed $removedCount non-Windows native module(s)"

# Create Velopack package
if ($env:AZURE_KEY_VAULT_CERTIFICATE_NAME) {
    Write-Host "Building with code signing..."
    vpk pack `
        --packId "ai.griptape.nodes.desktop" `
        --packVersion (node -p "require('./package.json').version") `
        --packDir "$AppDir" `
        --packTitle "Griptape Nodes" `
        --mainExe "$MainExe" `
        --icon "$IconPath" `
        --outputDir "Releases" `
        --runtime "$Runtime" `
        --channel "$Channel" `
        --framework "$Framework" `
        --verbose `
        --signTemplate "AzureSignTool sign -s -kvu $env:AZURE_KEY_VAULT_URI -kvc $env:AZURE_KEY_VAULT_CERTIFICATE_NAME -kvi $env:AZURE_KEY_VAULT_CLIENT_ID -kvs $env:AZURE_KEY_VAULT_CLIENT_SECRET -kvt $env:AZURE_KEY_VAULT_TENANT_ID -tr http://timestamp.globalsign.com/tsa/r6advanced1 -td sha256 -fd sha256 {{file}}"

} else {
    Write-Host "Building without code signing..."
    vpk pack `
        --packId "ai.griptape.nodes.desktop" `
        --packVersion (node -p "require('./package.json').version") `
        --packDir "$AppDir" `
        --packTitle "Griptape Nodes" `
        --mainExe "$MainExe" `
        --icon "$IconPath" `
        --outputDir "Releases" `
        --runtime "$Runtime" `
        --channel "$Channel" `
        --framework "$Framework"
}

Write-Host "Velopack build completed for $Runtime"

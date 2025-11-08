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

# Check for code signing certificate
$SignParams = $null
if ($env:WINDOWS_CERT_FILE) {
    Write-Host "Code signing certificate found, will sign binaries"

    # Convert to absolute path
    $CertPath = [System.IO.Path]::GetFullPath($env:WINDOWS_CERT_FILE)

    # Build signtool parameters
    # Note: Velopack expects signtool args without the initial "sign" command
    $SignParams = "/f `"$CertPath`" /tr http://timestamp.digicert.com /td sha256 /fd sha256 /d `"Griptape Nodes`""

    # Add password parameter if password is provided and non-empty
    if ($env:WINDOWS_CERT_PASSWORD -and $env:WINDOWS_CERT_PASSWORD -ne "") {
        $SignParams = "/f `"$CertPath`" /p `"$env:WINDOWS_CERT_PASSWORD`" /tr http://timestamp.digicert.com /td sha256 /fd sha256 /d `"Griptape Nodes`""
    }

    Write-Host "Sign parameters configured"
} else {
    Write-Host "WARNING: No code signing certificate found (WINDOWS_CERT_FILE not set). Build will not be signed."
}

# Create Velopack package
$VpkArgs = @(
    "pack",
    "--packId", "ai.griptape.nodes.desktop",
    "--packVersion", (node -p "require('./package.json').version"),
    "--packDir", "$AppDir",
    "--packTitle", "Griptape Nodes",
    "--mainExe", "$MainExe",
    "--icon", "$IconPath",
    "--outputDir", "Releases",
    "--runtime", "$Runtime",
    "--channel", "$Channel"
)

# Add signing parameters if available
if ($SignParams) {
    $VpkArgs += "--signParams"
    $VpkArgs += $SignParams
}

# Execute vpk pack
& vpk $VpkArgs

Write-Host "Velopack build completed for $Runtime"
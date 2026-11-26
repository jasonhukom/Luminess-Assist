param(
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoDir = Split-Path -Parent $scriptDir

Set-Location $repoDir

Write-Host "==> Starting build pipeline in $repoDir..." -ForegroundColor Cyan

if (-not $SkipTests) {
    Write-Host "==> Step 1: Running tests and linters..." -ForegroundColor Yellow
    npm test
    npm run lint
}

Write-Host "==> Step 2: Compiling frontend dist..." -ForegroundColor Yellow
npm run build

Write-Host "==> Step 3: Compiling Tauri app bundles (.exe and .msi)..." -ForegroundColor Yellow
npx tauri build

$bundleDir = Join-Path $repoDir "src-tauri\target\release\bundle"
$outputDir = Join-Path $repoDir "dist-binaries"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Locate .exe
$exeSource = Join-Path $repoDir "src-tauri\target\release\Luminess Assist.exe"
if (-not (Test-Path $exeSource)) {
    $exeSource = Join-Path $repoDir "src-tauri\target\release\luminess-assist.exe"
}
if (-not (Test-Path $exeSource)) {
    $exeSource = Join-Path $repoDir "src-tauri\target\release\app.exe"
}

# Locate .msi
$msiFiles = Get-ChildItem -Path "$bundleDir\msi\*.msi" -ErrorAction SilentlyContinue

# Locate .exe installer from nsis
$nsisFiles = Get-ChildItem -Path "$bundleDir\nsis\*.exe" -ErrorAction SilentlyContinue

if (Test-Path $exeSource) {
    Copy-Item $exeSource -Destination "$outputDir\Luminess Assist.exe" -Force
    # Also create desktop/directory shortcut if desired
    Write-Host "Copied executable to $outputDir\Luminess Assist.exe" -ForegroundColor Green
}

if ($nsisFiles) {
    foreach ($exe in $nsisFiles) {
        Copy-Item $exe.FullName -Destination "$outputDir\$($exe.Name)" -Force
        Write-Host "Copied setup executable to $outputDir\$($exe.Name)" -ForegroundColor Green
    }
}

if ($msiFiles) {
    foreach ($msi in $msiFiles) {
        Copy-Item $msi.FullName -Destination "$outputDir\$($msi.Name)" -Force
        Write-Host "Copied installer to $outputDir\$($msi.Name)" -ForegroundColor Green
    }
}

# Create convenience shortcut in repository root
$wshShell = New-Object -ComObject WScript.Shell
$shortcutPath = Join-Path $repoDir "Luminess Assist.lnk"
$targetExe = Join-Path $outputDir "Luminess Assist.exe"

if (Test-Path $targetExe) {
    $shortcut = $wshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $targetExe
    $shortcut.WorkingDirectory = $outputDir
    $shortcut.Description = "Launch Luminess Assist"
    $shortcut.Save()
    Write-Host "Created app shortcut at $shortcutPath" -ForegroundColor Green
}

Write-Host "==> Build and packaging completed successfully!" -ForegroundColor Green

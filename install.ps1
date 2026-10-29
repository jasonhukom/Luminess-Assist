# ==============================================================================
# Luminess Assist - Automated Installer & Desktop Shortcut Creator
# Version: Dynamic (Latest GitHub Release)
# Repository: https://github.com/jasonhukom/Luminess-Assist
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$FromSource = $false,
    [string]$Version = "",
    [switch]$Silent = $false
)

$ErrorActionPreference = "Stop"

if (-not $Version -or $Version -eq "latest") {
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
        $LatestReleaseJson = Invoke-RestMethod -Uri "https://api.github.com/repos/jasonhukom/Luminess-Assist/releases/latest" -Headers @{ "User-Agent" = "Luminess-Installer" } -UseBasicParsing -ErrorAction Stop
        $Version = ($LatestReleaseJson.tag_name -replace "^v", "").Trim()
    } catch {
        $Version = "1.1.3"
    }
}

function Write-LuminessBanner {
    Write-Host ""
    Write-Host "   __                                                    " -ForegroundColor Cyan
    Write-Host "  / /  __ _____ _  (_)__  ___ ___ ___   ___ ____ ___ (_)__ / /_" -ForegroundColor Cyan
    Write-Host " / /__/ // /  ' \/ / _ \/ -_|_-<(_-<  / _ `(_-<(_-</ (_-</ __/" -ForegroundColor Cyan
    Write-Host "/____/\_,_/_/_/_/_/_//_/\__/___/___/  \_,_/___/___/_/___/\__/  " -ForegroundColor Blue
    Write-Host "                 * Living Desktop AI Companion *        " -ForegroundColor DarkCyan
    Write-Host ""
}

Write-LuminessBanner
Write-Host ">>> Starting Luminess Assist v$Version Installation Pipeline..." -ForegroundColor Green

$InstallDir = Join-Path $env:LOCALAPPDATA "Programs\Luminess Assist"
if (-not (Test-Path $InstallDir)) {
    $InstallDir = Join-Path $env:LOCALAPPDATA "LuminessAssist"
}
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "Luminess Assist.lnk"

if ($FromSource) {
    Write-Host "`n>>> Developer Mode Selected: Building Luminess Assist from Source..." -ForegroundColor Yellow
    
    # Check Git
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Error "Git is required to build from source. Please install Git: https://git-scm.com/"
    }
    # Check Node
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error "Node.js (v20+) is required. Please install Node.js: https://nodejs.org/"
    }
    # Check Rust / Cargo
    if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
        Write-Error "Rust toolchain is required. Please install Rust: https://rustup.rs/"
    }

    $CloneDir = Join-Path $env:USERPROFILE "Luminess-Assist"
    if (-not (Test-Path $CloneDir)) {
        Write-Host "Cloning repository to $CloneDir..." -ForegroundColor Cyan
        git clone https://github.com/jasonhukom/Luminess-Assist.git $CloneDir
    } else {
        Write-Host "Repository exists at $CloneDir. Updating..." -ForegroundColor Cyan
        Set-Location $CloneDir
        git pull origin main
    }

    Set-Location $CloneDir
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    npm install

    Write-Host "Compiling native Tauri desktop binary (optimized release)..." -ForegroundColor Cyan
    npm run tauri build

    $ExeSource = Join-Path $CloneDir "src-tauri\target\release\app.exe"
    if (Test-Path $ExeSource) {
        New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
        $FinalExe = Join-Path $InstallDir "Luminess Assist.exe"
        Copy-Item -Path $ExeSource -Destination $FinalExe -Force

        # Create Desktop Shortcut
        $WScriptShell = New-Object -ComObject WScript.Shell
        $Shortcut = $WScriptShell.CreateShortcut($ShortcutPath)
        $Shortcut.TargetPath = $FinalExe
        $Shortcut.WorkingDirectory = $InstallDir
        $Shortcut.Description = "Luminess Assist - AI Desktop Companion"
        $Shortcut.Save()

        Write-Host "`n[SUCCESS] Desktop shortcut created at: $ShortcutPath" -ForegroundColor Green
        Write-Host "[LAUNCHING] Starting Luminess Assist..." -ForegroundColor Cyan
        Start-Process $FinalExe
        return
    }
}

# Standard Release Installer Download Flow
$ReleaseBaseUrl = "https://github.com/jasonhukom/Luminess-Assist/releases/download/v$Version"
$SetupFileName = "Luminess.Assist_${Version}_x64-setup.exe"
$DownloadUrl = "$ReleaseBaseUrl/$SetupFileName"
$TempInstallerPath = Join-Path $env:TEMP "Luminess-Assist-${Version}-setup.exe"

Write-Host ">>> Fetching Release Binary from GitHub: $DownloadUrl" -ForegroundColor Cyan
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempInstallerPath -UseBasicParsing
    Write-Host ">>> Download complete: $([math]::Round((Get-Item $TempInstallerPath).Length / 1MB, 2)) MB" -ForegroundColor Green
} catch {
    Write-Host "Direct download failed, falling back to raw binary..." -ForegroundColor Yellow
    $FallbackUrl = "https://github.com/jasonhukom/Luminess-Assist/releases/download/v$Version/Luminess%20Assist_${Version}_x64-setup.exe"
    Invoke-WebRequest -Uri $FallbackUrl -OutFile $TempInstallerPath -UseBasicParsing
}

Write-Host ">>> Executing Installer..." -ForegroundColor Cyan
if ($Silent) {
    Start-Process -FilePath $TempInstallerPath -ArgumentList "/S" -Wait
} else {
    Start-Process -FilePath $TempInstallerPath -Wait
}

# Verify / Create Desktop Shortcut if not auto-created by installer
$PossibleExePaths = @(
    "$env:LOCALAPPDATA\Programs\Luminess Assist\Luminess Assist.exe",
    "$env:ProgramFiles\Luminess Assist\Luminess Assist.exe",
    "$env:LOCALAPPDATA\LuminessAssist\Luminess Assist.exe",
    "$InstallDir\Luminess Assist.exe"
)

$InstalledExe = $PossibleExePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($InstalledExe) {
    $WScriptShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WScriptShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = $InstalledExe
    $Shortcut.WorkingDirectory = [System.IO.Path]::GetDirectoryName($InstalledExe)
    $Shortcut.Description = "Luminess Assist - Interactive AI Desktop Companion"
    $Shortcut.Save()
    Write-Host "`n>>> [SUCCESS] Desktop Shortcut ready at: $ShortcutPath" -ForegroundColor Green
    Write-Host ">>> [LAUNCH] Starting Luminess Assist now!" -ForegroundColor Cyan
    Start-Process -FilePath $InstalledExe
} else {
    Write-Host "`n>>> [NOTE] Setup completed. If shortcut was not automatically created on Desktop, start Luminess Assist from your Start Menu." -ForegroundColor Yellow
}

Write-Host "`n==============================================================================" -ForegroundColor DarkCyan
Write-Host " Luminess Assist is now active! Click the mascot anytime to chat or explore.  " -ForegroundColor Green
Write-Host "==============================================================================`n" -ForegroundColor DarkCyan

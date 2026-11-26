# ==============================================================================
# Luminess Assist - Automated Installer, Storage Allocator & Shortcut Creator
# Version: Dynamic (Latest GitHub Release)
# Repository: https://github.com/jasonhukom/Luminess-Assist
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$FromSource = $false,
    [string]$Version = "",
    [switch]$Silent = $false,
    [ValidateSet("lightweight", "recommended", "extended", "large", "unlimited", "")]
    [string]$StorageTier = ""
)

$ErrorActionPreference = "Stop"

if (-not $Version -or $Version -eq "latest") {
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
        $LatestReleaseJson = Invoke-RestMethod -Uri "https://api.github.com/repos/jasonhukom/Luminess-Assist/releases/latest" -Headers @{ "User-Agent" = "Luminess-Installer" } -UseBasicParsing -ErrorAction Stop
        $Version = ($LatestReleaseJson.tag_name -replace "^v", "").Trim()
    } catch {
        $Version = "1.3.0"
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

function Select-LuminessStorageAllocation {
    $DataDir = Join-Path $env:LOCALAPPDATA "LuminessAssist"
    New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
    $ConfigPath = Join-Path $DataDir "config.json"

    # Inspect actual available disk space on the installation drive
    $DriveRoot = [System.IO.Path]::GetPathRoot($DataDir)
    $DriveInfo = New-Object System.IO.DriveInfo($DriveRoot)
    $FreeDiskGb = [math]::Round($DriveInfo.AvailableFreeSpace / 1GB, 2)

    $Options = @(
        @{ Id = "lightweight"; Label = "Lightweight (1 GB)";       Bytes = 1073741824;  Desc = "Compact history, core user memory, and recent search cache." },
        @{ Id = "recommended"; Label = "Recommended (5 GB) [DEFAULT]"; Bytes = 5368709120;  Desc = "Best balance for years of chats, user memories, and search engine archives." },
        @{ Id = "extended";    Label = "Extended (10 GB)";         Bytes = 10737418240; Desc = "Expanded local database for power users and deep research history." },
        @{ Id = "large";       Label = "Large (25 GB)";            Bytes = 26843545600; Desc = "High-capacity archive for extensive local AI logs and search indices." },
        @{ Id = "unlimited";   Label = "Unlimited / Infinity";     Bytes = 0;           Desc = "No app-imposed cap; automatically respects physical free disk space ($FreeDiskGb GB free)." }
    )

    $SelectedOption = $Options[1] # Default: 5 GB Recommended

    if ($StorageTier) {
        $Matched = $Options | Where-Object { $_.Id -eq $StorageTier.ToLower() } | Select-Object -First 1
        if ($Matched) { $SelectedOption = $Matched }
    } elseif (-not $Silent) {
        Write-Host "==============================================================================" -ForegroundColor DarkCyan
        Write-Host " DATABASE STORAGE ALLOCATION SETUP (Available Disk Space: $FreeDiskGb GB)" -ForegroundColor Cyan
        Write-Host "==============================================================================" -ForegroundColor DarkCyan
        Write-Host ""
        Write-Host "Why we recommend 5 GB (Recommended):" -ForegroundColor Green
        Write-Host "  5 GB stores years of conversational history, your personal Google-synced" -ForegroundColor Gray
        Write-Host "  memories, and thousands of cached web search citations without risking" -ForegroundColor Gray
        Write-Host "  disk exhaustion. Choosing 'Unlimited / Infinity' removes the app quota" -ForegroundColor Gray
        Write-Host "  while still protecting your PC with an automatic 512 MB disk safety reserve." -ForegroundColor Gray
        Write-Host ""

        for ($i = 0; $i -lt $Options.Count; $i++) {
            $num = $i + 1
            $opt = $Options[$i]
            $color = if ($i -eq 1) { "Green" } else { "White" }
            Write-Host "  [$num] $($opt.Label)" -ForegroundColor $color
            Write-Host "      $($opt.Desc)" -ForegroundColor DarkGray
        }
        Write-Host ""
        $Choice = Read-Host "Select storage option [1-5] (Press Enter for 2 - Recommended 5 GB)"
        switch ($Choice.Trim()) {
            "1" { $SelectedOption = $Options[0] }
            "2" { $SelectedOption = $Options[1] }
            "3" { $SelectedOption = $Options[2] }
            "4" { $SelectedOption = $Options[3] }
            "5" { $SelectedOption = $Options[4] }
            default { $SelectedOption = $Options[1] }
        }
    }

    Write-Host ">>> Selected Storage Allocation: $($SelectedOption.Label)" -ForegroundColor Green

    $ConfigObj = [ordered]@{
        storageTier               = $SelectedOption.Id
        storageLimitBytes         = [uint64]$SelectedOption.Bytes
        installationCompleted     = $true
        localAiPreferredRuntime   = "auto"
        localAiEndpoint           = "http://127.0.0.1:11434"
        localAiModel              = "qwen2.5-coder:7b"
        searchEngineEnabled       = $true
        autoSaveSearchesToDb      = $true
        historyBox                = @{ x = 48;  y = 80; width = 350; height = 470; visible = $false }
        settingsBox               = @{ x = 420; y = 80; width = 380; height = 500; visible = $false }
    }

    $ConfigJson = $ConfigObj | ConvertTo-Json -Depth 5
    Set-Content -Path $ConfigPath -Value $ConfigJson -Encoding UTF8
    Write-Host ">>> Saved storage & runtime configuration to: $ConfigPath" -ForegroundColor Cyan
}

Write-LuminessBanner
Write-Host ">>> Starting Luminess Assist v$Version Installation Pipeline..." -ForegroundColor Green

# Ask user how much storage they want to allocate and save to config.json
Select-LuminessStorageAllocation

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

# ==============================================================================
# Local Agent CLI Setup: OpenCode & KiloCode
# ==============================================================================
# Refresh PATH so recently installed Node.js / npm global shims are discoverable
$ExtraBinDirs = @(
    "$env:ProgramFiles\nodejs",
    "$env:LOCALAPPDATA\Programs\nodejs",
    "$env:APPDATA\npm"
)
foreach ($Dir in $ExtraBinDirs) {
    if ((Test-Path $Dir) -and ($env:Path -notlike "*$Dir*")) {
        $env:Path = "$Dir;$env:Path"
    }
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue) -and (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host "`n>>> Node.js / npm not found. Installing Node.js LTS via winget for OpenCode & KiloCode..." -ForegroundColor Cyan
    try {
        winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements | Out-Null
        foreach ($Dir in $ExtraBinDirs) {
            if ((Test-Path $Dir) -and ($env:Path -notlike "*$Dir*")) {
                $env:Path = "$Dir;$env:Path"
            }
        }
    } catch {
        Write-Host ">>> [NOTE] Automatic Node.js install skipped: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

if (Get-Command npm -ErrorAction SilentlyContinue) {
    if (-not (Get-Command opencode -ErrorAction SilentlyContinue)) {
        Write-Host "`n>>> Installing OpenCode CLI (opencode-ai) for local agent mode..." -ForegroundColor Cyan
        try {
            npm install -g opencode-ai | Out-Null
            Write-Host ">>> [SUCCESS] OpenCode CLI installed (command: opencode)." -ForegroundColor Green
        } catch {
            Write-Host ">>> [NOTE] OpenCode global install skipped: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "`n>>> [VERIFIED] OpenCode CLI already installed on system." -ForegroundColor Green
    }

    if (-not ((Get-Command kilocode -ErrorAction SilentlyContinue) -or (Get-Command kilo -ErrorAction SilentlyContinue))) {
        Write-Host ">>> Installing KiloCode CLI (@kilocode/cli) for local agent mode..." -ForegroundColor Cyan
        try {
            npm install -g @kilocode/cli | Out-Null
            Write-Host ">>> [SUCCESS] KiloCode CLI installed (commands: kilo / kilocode)." -ForegroundColor Green
        } catch {
            Write-Host ">>> [NOTE] KiloCode global install skipped: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host ">>> [VERIFIED] KiloCode CLI already installed on system." -ForegroundColor Green
    }
} else {
    Write-Host "`n>>> [NOTE] npm was not found on PATH. Install Node.js LTS then run: npm install -g opencode-ai @kilocode/cli" -ForegroundColor Yellow
}

Write-Host "`n==============================================================================" -ForegroundColor DarkCyan
Write-Host " Luminess Assist is now active! Click the mascot anytime to chat or explore.  " -ForegroundColor Green
Write-Host "==============================================================================`n" -ForegroundColor DarkCyan

# One-command setup for the Stremio Streaming Server (Docker) + a public URL
# via a Cloudflare Tunnel, for people who don't want to touch a terminal
# beyond pasting this one command.
#
# Usage (in PowerShell):
#   irm https://raw.githubusercontent.com/Mohamedattiadev/stremio-web/stremio-server-setup/scripts/stremio-server-setup/install.ps1 | iex
#
# Safe to re-run: every step checks what's already there and skips it.
# If Windows needs a restart mid-way (WSL2 setup), just run the same command again after it restarts.

$ErrorActionPreference = 'Stop'
$ScriptUrl = 'https://raw.githubusercontent.com/Mohamedattiadev/stremio-web/stremio-server-setup/scripts/stremio-server-setup/install.ps1'

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  [!]  $msg" -ForegroundColor Yellow }
function Die($msg)  { Write-Host "  [X]  $msg" -ForegroundColor Red; Write-Host "`nSee https://docs.docker.com/desktop/setup/install/windows-install/ for manual steps."; exit 1 }

# ---------- 1. re-launch elevated if needed ----------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Step "Requesting administrator rights (Windows will show a prompt — click Yes)"
    Start-Process powershell -Verb RunAs -ArgumentList "-NoExit","-Command","irm $ScriptUrl | iex"
    exit
}

$DataDir = Join-Path $Env:USERPROFILE '.stremio-server-data'
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
$LogFile = Join-Path $DataDir 'tunnel.log'
$UrlFile = Join-Path $DataDir 'current-url.txt'
$CloudflaredExe = Join-Path $DataDir 'cloudflared.exe'

# ---------- 2. make sure WSL2 is available (Docker Desktop needs it) ----------
Step "Checking Windows Subsystem for Linux (required by Docker)"
$wslOk = $true
try { wsl --status *> $null } catch { $wslOk = $false }
if (-not $wslOk) {
    Warn "Installing WSL2 — this can require a restart"
    try {
        wsl --install --no-distribution
    } catch { Warn "Automatic WSL install failed, Docker's installer will try again" }
}

# ---------- 3. install Docker Desktop ----------
Step "Checking for Docker"
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCmd -and (docker info) 2>$null) {
    Ok "Docker is already installed and running"
} else {
    if (-not $dockerCmd) {
        Warn "Docker not found — installing Docker Desktop (this can take a few minutes)"
        $winget = Get-Command winget -ErrorAction SilentlyContinue
        if ($winget) {
            winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements --silent
        } else {
            $installer = Join-Path $Env:TEMP 'DockerDesktopInstaller.exe'
            Invoke-WebRequest -Uri 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe' -OutFile $installer
            Start-Process -FilePath $installer -ArgumentList 'install --quiet --accept-license' -Wait
        }
    }

    $dockerExe = "$Env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerExe) {
        Start-Process $dockerExe
    }

    Write-Host -NoNewline "  waiting for Docker to be ready"
    $ready = $false
    for ($i = 0; $i -lt 90; $i++) {
        try { docker info *> $null; $ready = $true; break } catch {}
        Write-Host -NoNewline "."
        Start-Sleep -Seconds 3
    }
    Write-Host ""
    if (-not $ready) {
        Warn "Docker isn't ready yet — this usually means Windows needs a restart to finish enabling WSL2."
        Warn "Restart your PC, then run this same command again — it will continue automatically."
        exit 1
    }
    Ok "Docker is up"
}

# ---------- 4. install cloudflared ----------
Step "Checking for cloudflared (used to give you a public URL)"
if (-not (Test-Path $CloudflaredExe)) {
    Warn "Installing cloudflared"
    Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $CloudflaredExe
    Ok "cloudflared installed"
} else {
    Ok "cloudflared already installed"
}

# ---------- 5. run the streaming server container ----------
Step "Starting the Stremio Streaming Server"
$existing = docker inspect stremio-server 2>$null
if ($LASTEXITCODE -eq 0) {
    docker start stremio-server *> $null
    Ok "Container already existed — made sure it's running"
} else {
    $serverDataDir = (Join-Path $DataDir 'server') -replace '\\','/'
    docker run -d --name stremio-server --restart unless-stopped `
        -p 11470:11470 -p 12470:12470 `
        -e NO_CORS=1 `
        -v "${serverDataDir}:/root/.stremio-server" `
        stremio/server:latest | Out-Null
    Ok "Container created and running"
}

Write-Host -NoNewline "  waiting for the server to respond on port 11470"
for ($i = 0; $i -lt 30; $i++) {
    try {
        Invoke-WebRequest -Uri 'http://127.0.0.1:11470/' -UseBasicParsing -TimeoutSec 2 *> $null
        break
    } catch {}
    Write-Host -NoNewline "."
    Start-Sleep -Seconds 1
}
Write-Host ""

# ---------- 6. start the tunnel ----------
Step "Opening a public URL for your server"
Get-Process cloudflared -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $CloudflaredExe } | Stop-Process -Force -ErrorAction SilentlyContinue
Set-Content -Path $LogFile -Value ''
Start-Process -FilePath $CloudflaredExe -ArgumentList "tunnel --url http://localhost:11470 --logfile `"$LogFile`"" -WindowStyle Hidden

Write-Host -NoNewline "  waiting for your URL"
$foundUrl = $null
for ($i = 0; $i -lt 30; $i++) {
    if (Test-Path $LogFile) {
        $match = Select-String -Path $LogFile -Pattern 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' -AllMatches | Select-Object -First 1
        if ($match) { $foundUrl = $match.Matches[0].Value; break }
    }
    Write-Host -NoNewline "."
    Start-Sleep -Seconds 1
}
Write-Host ""

if (-not $foundUrl) {
    Die "Could not get a tunnel URL. Check $LogFile for details, then re-run this command."
}
Set-Content -Path $UrlFile -Value $foundUrl

# ---------- 7. keep the tunnel coming back after login (best effort) ----------
try {
    $action = New-ScheduledTaskAction -Execute $CloudflaredExe -Argument "tunnel --url http://localhost:11470 --logfile `"$LogFile`""
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    Register-ScheduledTask -TaskName 'StremioServerTunnel' -Action $action -Trigger $trigger -Force -ErrorAction Stop | Out-Null
    Ok "The tunnel will relaunch automatically when you log in"
} catch {
    Warn "Couldn't set up auto-restart — if you restart your PC, just run this same command again"
}

# ---------- done ----------
try { Set-Clipboard -Value $foundUrl } catch {}
Set-Content -Path (Join-Path $Env:USERPROFILE 'Desktop\Stremio Streaming Server URL.txt') -Value $foundUrl

Write-Host "`nAll set!" -ForegroundColor Green
Write-Host "Paste this URL into Stremio -> Settings -> Streaming -> Add URL:"
Write-Host ""
Write-Host "  $foundUrl" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host ""
Write-Host "(it's also copied to your clipboard, and saved on your Desktop)"

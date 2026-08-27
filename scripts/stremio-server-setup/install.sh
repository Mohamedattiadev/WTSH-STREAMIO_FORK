#!/usr/bin/env bash
#
# One-command setup for the Stremio Streaming Server (Docker) + a public URL
# via a Cloudflare Tunnel, for people who don't want to touch a terminal
# beyond pasting this one command.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Mohamedattiadev/stremio-web/stremio-server-setup/scripts/stremio-server-setup/install.sh | bash
#
# Safe to re-run: every step checks what's already there and skips it.

set -u

# ---------- output helpers ----------
BOLD=$'\033[1m'; GREEN=$'\033[32m'; RED=$'\033[31m'; CYAN=$'\033[36m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
step()  { printf "\n${CYAN}${BOLD}==>${RESET} %s\n" "$1"; }
ok()    { printf "${GREEN}  ✓${RESET} %s\n" "$1"; }
warn()  { printf "${YELLOW}  !${RESET} %s\n" "$1"; }
fail()  { printf "${RED}  ✗${RESET} %s\n" "$1"; }
die()   { fail "$1"; echo; echo "Setup could not finish automatically. See: https://docs.docker.com/get-docker/"; exit 1; }

have_cmd() { command -v "$1" >/dev/null 2>&1; }

DATA_DIR="$HOME/.stremio-server-data"
PIDFILE="$DATA_DIR/tunnel.pid"
LOGFILE="$DATA_DIR/tunnel.log"
URLFILE="$DATA_DIR/current-url.txt"
mkdir -p "$DATA_DIR"

# ---------- 1. detect OS ----------
step "Checking your system"
case "$(uname -s)" in
    Linux*)  OS=linux ;;
    Darwin*) OS=macos ;;
    *) die "This script only supports Linux and macOS. On Windows, use the PowerShell command instead." ;;
esac
ARCH_RAW="$(uname -m)"
case "$ARCH_RAW" in
    x86_64|amd64) ARCH=amd64 ;;
    aarch64|arm64) ARCH=arm64 ;;
    armv7l) ARCH=arm ;;
    *) die "Unsupported CPU architecture: $ARCH_RAW" ;;
esac
ok "Detected $OS ($ARCH)"

# ---------- 2. sudo availability (Linux only, macOS Docker Desktop handles its own prompts) ----------
SUDO=""
if [ "$OS" = "linux" ] && [ "$(id -u)" != "0" ]; then
    if have_cmd sudo; then
        SUDO="sudo"
    else
        die "This script needs administrator rights to install Docker (no 'sudo' found). Please install Docker manually, then re-run this script."
    fi
fi

# ---------- 3. install Docker ----------
step "Checking for Docker"
if have_cmd docker && docker info >/dev/null 2>&1; then
    ok "Docker is already installed and running"
elif have_cmd docker && $SUDO docker info >/dev/null 2>&1; then
    ok "Docker is already installed and running"
else
    if have_cmd docker; then
        warn "Docker is installed but not running yet — starting it"
    else
        warn "Docker not found — installing it now (this can take a few minutes)"
        if [ "$OS" = "macos" ]; then
            if have_cmd brew; then
                brew install --cask docker || die "Homebrew failed to install Docker Desktop"
            else
                TMPDMG="$(mktemp -t docker).dmg"
                CASK_URL="https://desktop.docker.com/mac/main/${ARCH}/Docker.dmg"
                curl -fsSL "$CASK_URL" -o "$TMPDMG" || die "Could not download Docker Desktop"
                MOUNT_DIR="$(mktemp -d)"
                hdiutil attach "$TMPDMG" -mountpoint "$MOUNT_DIR" -nobrowse -quiet || die "Could not open Docker Desktop installer"
                cp -R "$MOUNT_DIR/Docker.app" /Applications/ || die "Could not install Docker Desktop into /Applications"
                hdiutil detach "$MOUNT_DIR" -quiet
                rm -f "$TMPDMG"
            fi
        else
            if [ -f /etc/os-release ]; then . /etc/os-release; fi
            if have_cmd pacman; then
                $SUDO pacman -Sy --noconfirm docker || die "pacman failed to install docker"
            else
                curl -fsSL https://get.docker.com | $SUDO sh || die "Docker's install script failed"
            fi
        fi
    fi

    if [ "$OS" = "macos" ]; then
        open -a Docker
        warn "Docker Desktop is starting for the first time — macOS may ask for your password once to finish setup, that's normal."
    else
        if have_cmd systemctl; then
            $SUDO systemctl enable --now docker || true
        fi
        $SUDO usermod -aG docker "$USER" 2>/dev/null || true
        if ! docker info >/dev/null 2>&1; then
            SUDO="sudo"
        fi
    fi

    printf "  waiting for Docker to be ready"
    for _ in $(seq 1 60); do
        if $SUDO docker info >/dev/null 2>&1; then break; fi
        printf "."
        sleep 3
    done
    echo
    $SUDO docker info >/dev/null 2>&1 || die "Docker did not start in time. Open Docker Desktop manually and re-run this command once it says 'Docker Desktop is running'."
    ok "Docker is up"
fi
DOCKER="docker"; $DOCKER info >/dev/null 2>&1 || DOCKER="$SUDO docker"

# ---------- 4. install cloudflared ----------
step "Checking for cloudflared (used to give you a public URL)"
if have_cmd cloudflared; then
    ok "cloudflared already installed"
else
    warn "Installing cloudflared"
    if [ "$OS" = "macos" ]; then
        TMPTGZ="$(mktemp -t cloudflared).tgz"
        curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz" -o "$TMPTGZ" || die "Could not download cloudflared"
        TMPDIR_CF="$(mktemp -d)"
        tar -xzf "$TMPTGZ" -C "$TMPDIR_CF" || die "Could not extract cloudflared"
        [ -s "$TMPDIR_CF/cloudflared" ] || die "Downloaded cloudflared is empty (check disk space with 'df -h')"
        $SUDO mv "$TMPDIR_CF/cloudflared" /usr/local/bin/cloudflared || die "Could not install cloudflared to /usr/local/bin (check disk space with 'df -h')"
        chmod +x /usr/local/bin/cloudflared
    else
        curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}" -o /tmp/cloudflared || die "Could not download cloudflared"
        [ -s /tmp/cloudflared ] || die "Downloaded cloudflared is empty (check disk space with 'df -h')"
        chmod +x /tmp/cloudflared
        $SUDO mv /tmp/cloudflared /usr/local/bin/cloudflared || die "Could not install cloudflared to /usr/local/bin (check disk space with 'df -h')"
    fi
    /usr/local/bin/cloudflared --version >/dev/null 2>&1 || die "cloudflared did not install correctly (check disk space with 'df -h')"
    ok "cloudflared installed"
fi

# ---------- 5. run the streaming server container ----------
step "Starting the Stremio Streaming Server"
NEEDS_RECREATE=0
if $DOCKER inspect stremio-server >/dev/null 2>&1; then
    if $DOCKER inspect stremio-server --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^NO_CORS=.\+'; then
        $DOCKER start stremio-server >/dev/null 2>&1 || true
        ok "Container already existed — made sure it's running"
    else
        warn "Existing container has CORS enabled (would show 'Error' in the app) — recreating it with NO_CORS=1"
        NEEDS_RECREATE=1
    fi
else
    NEEDS_RECREATE=1
fi

if [ "$NEEDS_RECREATE" = "1" ]; then
    $DOCKER rm -f stremio-server >/dev/null 2>&1 || true
    $DOCKER run -d --name stremio-server --restart unless-stopped \
        -p 11470:11470 -p 12470:12470 \
        -e NO_CORS=1 \
        -v stremio-server-data:/root/.stremio-server \
        stremio/server:latest >/dev/null || die "Could not start the streaming server container"
    ok "Container created and running"
fi

printf "  waiting for the server to respond on port 11470"
for _ in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:11470/" >/dev/null 2>&1; then break; fi
    printf "."
    sleep 1
done
echo

# ---------- 6. start (or restart) the tunnel ----------
step "Opening a public URL for your server"
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    sleep 1
fi
: > "$LOGFILE"
nohup cloudflared tunnel --url http://localhost:11470 --logfile "$LOGFILE" >/dev/null 2>&1 &
echo $! > "$PIDFILE"

printf "  waiting for your URL"
FOUND_URL=""
for _ in $(seq 1 30); do
    FOUND_URL="$(grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$LOGFILE" 2>/dev/null | head -n1)"
    if [ -n "$FOUND_URL" ]; then break; fi
    printf "."
    sleep 1
done
echo

[ -n "$FOUND_URL" ] || die "Could not get a tunnel URL. Check $LOGFILE for details, then re-run this command."
echo "$FOUND_URL" > "$URLFILE"

# ---------- 7. keep the tunnel coming back after reboot (best effort) ----------
WRAPPER="$DATA_DIR/start-tunnel.sh"
cat > "$WRAPPER" <<EOF
#!/usr/bin/env bash
pkill -f "cloudflared tunnel --url http://localhost:11470" >/dev/null 2>&1 || true
sleep 1
: > "$LOGFILE"
nohup cloudflared tunnel --url http://localhost:11470 --logfile "$LOGFILE" >/dev/null 2>&1 &
echo \$! > "$PIDFILE"
for i in \$(seq 1 30); do
    URL="\$(grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$LOGFILE" | head -n1)"
    [ -n "\$URL" ] && { echo "\$URL" > "$URLFILE"; break; }
    sleep 1
done
EOF
chmod +x "$WRAPPER"

if [ "$OS" = "macos" ]; then
    PLIST="$HOME/Library/LaunchAgents/com.stremio.tunnel.plist"
    mkdir -p "$HOME/Library/LaunchAgents"
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
    <key>Label</key><string>com.stremio.tunnel</string>
    <key>ProgramArguments</key><array><string>$WRAPPER</string></array>
    <key>RunAtLoad</key><true/>
</dict></plist>
EOF
    launchctl unload "$PLIST" >/dev/null 2>&1 || true
    launchctl load "$PLIST" >/dev/null 2>&1 || true
    ok "The tunnel will relaunch automatically when you log in"
elif have_cmd crontab; then
    ( crontab -l 2>/dev/null | grep -v "$WRAPPER" ; echo "@reboot $WRAPPER" ) | crontab - 2>/dev/null || true
    ok "The tunnel will relaunch automatically after a restart"
else
    warn "Couldn't set up auto-restart — if you reboot, just run this same command again"
fi

# ---------- done ----------
echo
printf "${GREEN}${BOLD}All set!${RESET}\n"
echo "Paste this URL into Stremio -> Settings -> Streaming -> Add URL:"
echo
printf "  ${BOLD}${FOUND_URL}${RESET}\n"
echo
echo "(saved to $URLFILE — if it ever changes, e.g. after a restart, just open that file or re-run this command)"

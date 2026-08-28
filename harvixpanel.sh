#!/usr/bin/env bash

set -e

# ============================================================
# HarvixPanel Installer
# Project: HarvixNodes
# ============================================================

REPO_URL="https://github.com/yoshidaranimahato-collab/HarvixNodes.git"
INSTALL_DIR="/opt/harvixpanel"
SERVICE_NAME="harvixpanel"
APP_PORT="${PORT:-3000}"

# ------------------------------------------------------------
# Colors
# ------------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RESET='\033[0m'

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

log() {
    echo -e "${GREEN}[HarvixPanel]${RESET} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${RESET} $1"
}

error() {
    echo -e "${RED}[ERROR]${RESET} $1"
}

pause() {
    echo
    read -rp "Press Enter to continue..."
}

check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        error "Please run this installer as root."
        echo
        echo "Example:"
        echo "sudo bash <(curl -fsSL https://raw.githubusercontent.com/yoshidaranimahato-collab/HarvixNodes/main/installer/harvixpanel.sh)"
        exit 1
    fi
}

detect_os() {
    if [ ! -f /etc/os-release ]; then
        error "Cannot detect operating system."
        exit 1
    fi

    . /etc/os-release

    OS_ID="${ID:-unknown}"

    case "$OS_ID" in
        ubuntu|debian)
            ;;
        *)
            warn "This installer is mainly tested for Ubuntu/Debian."
            read -rp "Continue anyway? [y/N]: " ANSWER

            if [[ ! "$ANSWER" =~ ^[Yy]$ ]]; then
                exit 1
            fi
            ;;
    esac
}

install_dependencies() {
    log "Installing required packages..."

    export DEBIAN_FRONTEND=noninteractive

    apt-get update -y

    apt-get install -y \
        curl \
        git \
        ca-certificates \
        build-essential

    log "Installing Node.js..."

    if command -v node >/dev/null 2>&1; then
        NODE_VERSION="$(node -v | sed 's/v//' | cut -d. -f1)"

        if [ "$NODE_VERSION" -ge 20 ]; then
            log "Node.js $(node -v) is already installed."
        else
            warn "Existing Node.js version is older than 20."
            install_nodejs
        fi
    else
        install_nodejs
    fi

    if ! command -v npm >/dev/null 2>&1; then
        error "npm installation failed."
        exit 1
    fi

    log "Node.js: $(node -v)"
    log "npm: $(npm -v)"
}

install_nodejs() {
    log "Installing Node.js 20..."

    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

    apt-get install -y nodejs

    if ! command -v node >/dev/null 2>&1; then
        error "Node.js installation failed."
        exit 1
    fi
}

download_panel() {
    log "Downloading HarvixPanel..."

    if [ -d "$INSTALL_DIR/.git" ]; then
        log "Existing Git repository detected."
        cd "$INSTALL_DIR"

        git fetch --all
        git reset --hard origin/main
    else
        rm -rf "$INSTALL_DIR"

        mkdir -p "$(dirname "$INSTALL_DIR")"

        git clone "$REPO_URL" "$INSTALL_DIR"

        cd "$INSTALL_DIR"
    fi
}

install_npm_dependencies() {
    cd "$INSTALL_DIR"

    if [ ! -f package.json ]; then
        error "package.json was not found."
        exit 1
    fi

    log "Installing npm dependencies..."

    npm install

    log "npm dependencies installed."
}

configure_environment() {
    log "Configuring HarvixPanel..."

    mkdir -p "$INSTALL_DIR"

    if [ ! -f "$INSTALL_DIR/.env" ]; then

        echo
        echo "======================================"
        echo " HarvixPanel Admin Password"
        echo "======================================"
        echo

        while true; do
            read -rsp "Enter admin password: " ADMIN_PASSWORD
            echo

            if [ -z "$ADMIN_PASSWORD" ]; then
                warn "Password cannot be empty."
                continue
            fi

            read -rsp "Confirm admin password: " ADMIN_PASSWORD_CONFIRM
            echo

            if [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]; then
                warn "Passwords do not match."
                continue
            fi

            break
        done

        cat > "$INSTALL_DIR/.env" <<EOF
PORT=$APP_PORT
HARVIX_ADMIN_PASSWORD=$ADMIN_PASSWORD
NODE_ENV=production
EOF

        chmod 600 "$INSTALL_DIR/.env"

        log ".env created."
    else
        log ".env already exists. Keeping existing configuration."
    fi
}

create_service() {
    log "Creating systemd service..."

    cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=HarvixPanel Minecraft Hosting Panel
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"

    log "Systemd service created."
}

start_panel() {
    log "Starting HarvixPanel..."

    systemctl restart "$SERVICE_NAME"

    sleep 3

    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log "HarvixPanel is running."
    else
        error "HarvixPanel failed to start."
        echo
        echo "View logs with:"
        echo "journalctl -u $SERVICE_NAME -n 100 --no-pager"
        exit 1
    fi
}

open_firewall() {
    if command -v ufw >/dev/null 2>&1; then

        if ufw status 2>/dev/null | grep -q "Status: active"; then
            log "Opening port $APP_PORT in UFW..."
            ufw allow "$APP_PORT/tcp" >/dev/null
        fi
    fi
}

get_server_ip() {
    SERVER_IP="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"

    if [ -z "$SERVER_IP" ]; then
        SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
    fi

    if [ -z "$SERVER_IP" ]; then
        SERVER_IP="YOUR_SERVER_IP"
    fi
}

install_panel() {
    echo
    echo "======================================"
    echo "        Installing HarvixPanel"
    echo "======================================"
    echo

    install_dependencies
    download_panel
    install_npm_dependencies
    configure_environment
    create_service
    open_firewall
    start_panel
    get_server_ip

    echo
    echo "======================================"
    echo "       Installation Complete"
    echo "======================================"
    echo

    echo -e "${GREEN}HarvixPanel is now running.${RESET}"
    echo
    echo "Panel URL:"
    echo "http://${SERVER_IP}:${APP_PORT}"
    echo
    echo "Installation directory:"
    echo "$INSTALL_DIR"
    echo
    echo "Useful commands:"
    echo
    echo "  systemctl status $SERVICE_NAME"
    echo "  systemctl restart $SERVICE_NAME"
    echo "  systemctl stop $SERVICE_NAME"
    echo "  journalctl -u $SERVICE_NAME -f"
    echo

    pause
}

stop_panel() {
    if systemctl list-unit-files 2>/dev/null | grep -q "^${SERVICE_NAME}.service"; then
        systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    fi
}

uninstall_panel() {
    echo
    echo "======================================"
    echo "        Uninstall HarvixPanel"
    echo "======================================"
    echo

    warn "This will remove:"
    echo "  - HarvixPanel"
    echo "  - Its systemd service"
    echo "  - The installation directory"
    echo

    read -rp "Type YES to continue: " CONFIRM

    if [ "$CONFIRM" != "YES" ]; then
        echo "Uninstall cancelled."
        pause
        return
    fi

    stop_panel

    systemctl disable "$SERVICE_NAME" 2>/dev/null || true

    rm -f "/etc/systemd/system/${SERVICE_NAME}.service"

    systemctl daemon-reload

    if command -v ufw >/dev/null 2>&1; then
        if ufw status 2>/dev/null | grep -q "Status: active"; then
            ufw delete allow "$APP_PORT/tcp" >/dev/null 2>&1 || true
        fi
    fi

    rm -rf "$INSTALL_DIR"

    log "HarvixPanel has been uninstalled."

    pause
}

update_panel() {
    echo
    echo "======================================"
    echo "          Updating HarvixPanel"
    echo "======================================"
    echo

    if [ ! -d "$INSTALL_DIR/.git" ]; then
        warn "HarvixPanel is not installed."
        echo "Use option 1 to install it first."
        pause
        return
    fi

    stop_panel

    cd "$INSTALL_DIR"

    log "Downloading latest GitHub version..."

    git fetch --all
    git reset --hard origin/main

    log "Installing dependencies..."

    npm install

    systemctl daemon-reload
    start_panel

    log "HarvixPanel updated successfully."

    pause
}

reinstall_panel() {
    echo
    echo "======================================"
    echo "         Reinstall HarvixPanel"
    echo "======================================"
    echo

    warn "Reinstall will remove the current installation."

    read -rp "Type YES to continue: " CONFIRM

    if [ "$CONFIRM" != "YES" ]; then
        echo "Reinstall cancelled."
        pause
        return
    fi

    stop_panel

    systemctl disable "$SERVICE_NAME" 2>/dev/null || true

    rm -f "/etc/systemd/system/${SERVICE_NAME}.service"

    systemctl daemon-reload

    rm -rf "$INSTALL_DIR"

    install_dependencies
    download_panel
    install_npm_dependencies
    configure_environment
    create_service
    open_firewall
    start_panel
    get_server_ip

    echo
    echo "======================================"
    echo "       Reinstallation Complete"
    echo "======================================"
    echo
    echo "Panel:"
    echo "http://${SERVER_IP}:${APP_PORT}"
    echo

    pause
}

show_menu() {
    clear

    echo
    echo -e "${CYAN}╔══════════════════════════════════╗${RESET}"
    echo -e "${CYAN}║          HarvixPanel             ║${RESET}"
    echo -e "${CYAN}╚══════════════════════════════════╝${RESET}"
    echo
    echo "1. Install Panel"
    echo "2. Uninstall Panel"
    echo "3. Update Panel"
    echo "4. Reinstall Panel"
    echo "5. Exit"
    echo
}

main() {
    check_root
    detect_os

    while true; do
        show_menu

        read -rp "[Choose any number ex - 1]: " CHOICE

        case "$CHOICE" in
            1)
                install_panel
                ;;
            2)
                uninstall_panel
                ;;
            3)
                update_panel
                ;;
            4)
                reinstall_panel
                ;;
            5)
                echo
                echo "Goodbye!"
                exit 0
                ;;
            *)
                error "Invalid option."
                sleep 1
                ;;
        esac
    done
}

main "$@"

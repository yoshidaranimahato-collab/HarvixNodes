#!/usr/bin/env bash

set -e

APP_NAME="HarvixPanel"
APP_DIR="/opt/harvixpanel"
REPO="https://github.com/yoshidaranimahato-collab/HarvixNodes.git"
PORT="6969"
SERVICE_NAME="harvixpanel"

clear

echo "╔══════════════════════════════════╗"
echo "║          HarvixPanel             ║"
echo "╚══════════════════════════════════╝"
echo
echo "1. Install Panel"
echo "2. Uninstall Panel"
echo "3. Update Panel"
echo "4. Reinstall Panel"
echo "5. Exit"
echo

read -rp "[Choose any number ex - 1]: " CHOICE


check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo
        echo "Please run this installer as root."
        echo
        exit 1
    fi
}


check_dependencies() {

    echo
    echo "[1/5] Checking required packages..."
    echo

    export DEBIAN_FRONTEND=noninteractive

    apt-get update

    # Do NOT upgrade existing Git.
    # This avoids dpkg cross-device problems
    # on some VPS/container environments.

    if ! command -v curl >/dev/null 2>&1; then
        echo "Installing curl..."
        apt-get install -y curl
    else
        echo "curl: already installed"
    fi

    if ! command -v git >/dev/null 2>&1; then
        echo "Installing git..."
        apt-get install -y git
    else
        echo "git: already installed"
    fi

    if ! command -v openssl >/dev/null 2>&1; then
        echo "Installing openssl..."
        apt-get install -y openssl
    else
        echo "openssl: already installed"
    fi

    echo
    echo "Required packages are ready."
}


install_node() {

    echo
    echo "[2/5] Checking Node.js..."
    echo

    if command -v node >/dev/null 2>&1; then

        NODE_VERSION="$(node -v)"
        echo "Node.js already installed: $NODE_VERSION"

    else

        echo "Installing Node.js 20..."

        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs

    fi

    echo
    echo "Node.js:"
    node --version

    echo "npm:"
    npm --version
}


download_panel() {

    echo
    echo "[3/5] Downloading HarvixPanel..."
    echo

    if [ -d "$APP_DIR/.git" ]; then

        echo "Existing installation found."
        echo "Updating repository..."

        cd "$APP_DIR"

        git fetch origin
        git reset --hard origin/main

    else

        echo "Cloning HarvixPanel..."

        rm -rf "$APP_DIR"

        git clone "$REPO" "$APP_DIR"

        cd "$APP_DIR"

    fi

    echo
    echo "Panel files downloaded."
}


install_dependencies() {

    echo
    echo "[4/5] Installing dependencies..."
    echo

    cd "$APP_DIR"

    npm install --omit=dev

    mkdir -p "$APP_DIR/data"

    if [ ! -f "$APP_DIR/.env" ]; then

        echo "Creating .env..."

        JWT_SECRET="$(openssl rand -hex 32)"

        cat > "$APP_DIR/.env" <<EOF
PORT=$PORT
JWT_SECRET=$JWT_SECRET
DATABASE_FILE=$APP_DIR/data/harvix.json
EOF

        chmod 600 "$APP_DIR/.env"

    else

        echo ".env already exists. Keeping existing configuration."

    fi

    echo
    echo "Dependencies installed."
}


create_service() {

    echo
    echo "[5/5] Creating system service..."
    echo

    cat > "/etc/systemd/system/$SERVICE_NAME.service" <<EOF
[Unit]
Description=HarvixPanel Minecraft Hosting Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/node $APP_DIR/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload

    systemctl enable "$SERVICE_NAME"

    systemctl restart "$SERVICE_NAME"

    sleep 2

    if systemctl is-active --quiet "$SERVICE_NAME"; then

        echo
        echo "╔══════════════════════════════════╗"
        echo "║      Installation Complete       ║"
        echo "╚══════════════════════════════════╝"
        echo
        echo "Panel Port: $PORT"
        echo
        echo "Open:"
        echo "http://YOUR_SERVER_IP:$PORT"
        echo
        echo "Service:"
        echo "systemctl status $SERVICE_NAME"
        echo

    else

        echo
        echo "HarvixPanel service failed to start."
        echo
        echo "Run:"
        echo "journalctl -u $SERVICE_NAME -n 50 --no-pager"
        echo

        exit 1
    fi
}


install_panel() {

    check_root

    echo
    echo "Installing $APP_NAME..."
    echo

    check_dependencies
    install_node
    download_panel
    install_dependencies
    create_service
}


uninstall_panel() {

    check_root

    echo
    echo "Stopping HarvixPanel..."
    echo

    systemctl disable --now "$SERVICE_NAME" 2>/dev/null || true

    rm -f "/etc/systemd/system/$SERVICE_NAME.service"

    systemctl daemon-reload

    echo
    read -rp "Delete panel files from $APP_DIR? [y/N]: " CONFIRM

    if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then

        rm -rf "$APP_DIR"

        echo
        echo "Panel files deleted."

    else

        echo
        echo "Panel files kept."

    fi

    echo
    echo "HarvixPanel uninstalled."
}


update_panel() {

    check_root

    if [ ! -d "$APP_DIR" ]; then

        echo
        echo "HarvixPanel is not installed."
        echo "Choose option 1 first."
        exit 1

    fi

    echo
    echo "Updating HarvixPanel..."
    echo

    cd "$APP_DIR"

    if [ ! -d ".git" ]; then

        echo "Git repository not found."
        echo "Please reinstall the panel."
        exit 1

    fi

    git fetch origin
    git reset --hard origin/main

    npm install --omit=dev

    systemctl restart "$SERVICE_NAME"

    echo
    echo "Update complete."
    echo
    echo "Service status:"
    systemctl --no-pager --full status "$SERVICE_NAME" || true
}


reinstall_panel() {

    check_root

    echo
    echo "Reinstalling HarvixPanel..."
    echo

    systemctl disable --now "$SERVICE_NAME" 2>/dev/null || true

    rm -f "/etc/systemd/system/$SERVICE_NAME.service"

    systemctl daemon-reload

    rm -rf "$APP_DIR"

    install_panel
}


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
        echo "Goodbye."
        exit 0
        ;;

    *)
        echo
        echo "Invalid option."
        exit 1
        ;;

esac

#!/usr/bin/env bash

set -e

APP_NAME="HarvixPanel"
APP_DIR="/opt/harvixpanel"
REPO="https://github.com/yoshidaranimahato-collab/HarvixNodes.git"
PORT="6969"

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

install_panel() {

    echo
    echo "Installing $APP_NAME..."
    echo

    if [ "$EUID" -ne 0 ]; then
        echo "Please run this installer as root."
        exit 1
    fi

    echo "[1/5] Installing required packages..."

    apt-get update -y

    apt-get install -y \
        curl \
        git \
        ca-certificates

    echo "[2/5] Installing Node.js..."

    if ! command -v node >/dev/null 2>&1; then

        curl -fsSL https://deb.nodesource.com/setup_20.x \
            | bash -

        apt-get install -y nodejs

    fi

    echo
    node --version
    npm --version

    echo "[3/5] Downloading HarvixPanel..."

    if [ -d "$APP_DIR/.git" ]; then

        cd "$APP_DIR"

        git pull --ff-only

    else

        rm -rf "$APP_DIR"

        git clone "$REPO" "$APP_DIR"

        cd "$APP_DIR"

    fi

    echo "[4/5] Installing dependencies..."

    npm install --omit=dev

    mkdir -p "$APP_DIR/data"

    if [ ! -f "$APP_DIR/.env" ]; then

        JWT_SECRET="$(openssl rand -hex 32 2>/dev/null || date +%s%N)"

        cat > "$APP_DIR/.env" <<EOF
PORT=$PORT
JWT_SECRET=$JWT_SECRET
DATABASE_FILE=$APP_DIR/data/harvix.json
EOF

    fi

    echo "[5/5] Creating system service..."

    cat > /etc/systemd/system/harvixpanel.service <<EOF
[Unit]
Description=HarvixPanel
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload

    systemctl enable harvixpanel

    systemctl restart harvixpanel

    echo
    echo "╔══════════════════════════════════╗"
    echo "║      Installation Complete       ║"
    echo "╚══════════════════════════════════╝"
    echo
    echo "Panel:"
    echo "http://YOUR_SERVER_IP:$PORT"
    echo
    echo "Service:"
    echo "systemctl status harvixpanel"
    echo
}

uninstall_panel() {

    if [ "$EUID" -ne 0 ]; then
        echo "Please run this installer as root."
        exit 1
    fi

    echo
    echo "Stopping HarvixPanel..."

    systemctl disable --now harvixpanel 2>/dev/null || true

    rm -f /etc/systemd/system/harvixpanel.service

    systemctl daemon-reload

    echo
    read -rp "Delete panel files from $APP_DIR? [y/N]: " CONFIRM

    if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
        rm -rf "$APP_DIR"
        echo "Panel files deleted."
    else
        echo "Panel files kept."
    fi

    echo "HarvixPanel uninstalled."
}

update_panel() {

    if [ "$EUID" -ne 0 ]; then
        echo "Please run this installer as root."
        exit 1
    fi

    if [ ! -d "$APP_DIR" ]; then
        echo "HarvixPanel is not installed."
        echo "Choose option 1 first."
        exit 1
    fi

    echo
    echo "Updating HarvixPanel..."

    cd "$APP_DIR"

    git pull --ff-only

    npm install --omit=dev

    systemctl restart harvixpanel

    echo
    echo "Update complete."
}

reinstall_panel() {

    if [ "$EUID" -ne 0 ]; then
        echo "Please run this installer as root."
        exit 1
    fi

    echo
    echo "Reinstalling HarvixPanel..."
    echo

    systemctl disable --now harvixpanel 2>/dev/null || true

    rm -f /etc/systemd/system/harvixpanel.service

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
        echo "Goodbye."
        exit 0
        ;;

    *)
        echo
        echo "Invalid option."
        exit 1
        ;;

esac

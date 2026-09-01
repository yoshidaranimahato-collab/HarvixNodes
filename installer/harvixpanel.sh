#!/usr/bin/env bash

set -e

APP_NAME="HarvixPanel"
APP_DIR="/opt/harvixpanel"
REPO="https://github.com/yoshidaranimahato-collab/HarvixNodes.git"
DEFAULT_PORT="6969"

show_menu() {

    clear

    echo "██╗░░██╗░█████╗░██████╗░██╗░░░██╗██╗██╗░░██╗"
    echo "██║░░██║██╔══██╗██╔══██╗██║░░░██║██║╚██╗██╔╝"
    echo "███████║███████║██████╔╝╚██╗░██╔╝██║░╚███╔╝░"
    echo "██╔══██║██╔══██║██╔══██╗░╚████╔╝░██║░██╔██╗░"
    echo "██║░░██║██║░░██║██║░░██║░░╚██╔╝░░██║██╔╝╚██╗"
    echo "╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚═╝░░░╚═╝░░░╚═╝╚═╝░░╚═╝"

    echo
    echo "========================================"
    echo "          HARVIXPANEL INSTALLER"
    echo "========================================"
    echo
    echo "1. Install Panel"
    echo "2. Uninstall Panel"
    echo "3. Update Panel"
    echo "4. Reinstall Panel"
    echo "5. Node Setup"
    echo "6. Exit"
    echo

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
            node_setup
            ;;

        6)
            echo
            echo "Goodbye."
            exit 0
            ;;

        *)
            echo
            echo "Invalid option."
            sleep 2
            show_menu
            ;;

    esac
}


check_root() {

    if [ "$EUID" -ne 0 ]; then

        echo
        echo "Please run this installer as root."
        echo

        exit 1

    fi
}


pause_menu() {

    echo
    read -rp "Press ENTER to go to main menu: " _
    show_menu
}


ask_admin_setup() {

    echo
    echo "========================================"
    echo "          ADMIN ACCOUNT SETUP"
    echo "========================================"
    echo

    while true; do

        read -rp "Admin username: " ADMIN_USERNAME

        if [ -n "$ADMIN_USERNAME" ]; then
            break
        fi

        echo "Username cannot be empty."

    done


    while true; do

        read -rsp "Admin password: " ADMIN_PASSWORD
        echo

        if [ -n "$ADMIN_PASSWORD" ]; then
            break
        fi

        echo "Password cannot be empty."

    done


    read -rp "Panel port [$DEFAULT_PORT]: " PANEL_PORT

    if [ -z "$PANEL_PORT" ]; then
        PANEL_PORT="$DEFAULT_PORT"
    fi


    if ! [[ "$PANEL_PORT" =~ ^[0-9]+$ ]]; then

        echo
        echo "Invalid port."
        exit 1

    fi


    if [ "$PANEL_PORT" -lt 1 ] || [ "$PANEL_PORT" -gt 65535 ]; then

        echo
        echo "Port must be between 1 and 65535."
        exit 1

    fi

}


install_required_packages() {

    echo
    echo "[1/5] Checking required packages..."
    echo

    export DEBIAN_FRONTEND=noninteractive

    apt-get update


    if command -v curl >/dev/null 2>&1; then

        echo "✓ curl already installed"

    else

        echo "Installing curl..."
        apt-get install -y curl

    fi


    if command -v git >/dev/null 2>&1; then

        echo "✓ git already installed"

    else

        echo "Installing git..."
        apt-get install -y git

    fi


    if command -v openssl >/dev/null 2>&1; then

        echo "✓ openssl already installed"

    else

        echo "Installing openssl..."
        apt-get install -y openssl

    fi

    echo
    echo "Required packages ready."
}


install_node() {

    echo
    echo "[2/5] Checking Node.js..."
    echo

    if command -v node >/dev/null 2>&1; then

        echo "✓ Node.js already installed"
        echo "Node.js: $(node -v)"

    else

        echo "Installing Node.js 20..."

        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs

        echo "✓ Node.js installed"

    fi

    echo
    echo "Node.js: $(node -v)"
    echo "npm: $(npm -v)"
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
    echo "✓ Panel files downloaded."
}


configure_panel() {

    echo
    echo "[4/5] Installing dependencies..."
    echo

    cd "$APP_DIR"

    npm install --omit=dev

    mkdir -p "$APP_DIR/data"


    if [ ! -f "$APP_DIR/.env" ]; then

        JWT_SECRET="$(openssl rand -hex 32)"

        cat > "$APP_DIR/.env" <<EOF
PORT=$PANEL_PORT
JWT_SECRET=$JWT_SECRET
DATABASE_FILE=$APP_DIR/data/harvix.json
EOF

        chmod 600 "$APP_DIR/.env"

        echo "✓ .env created."

    else

        echo "✓ Existing .env kept."

    fi

    echo
    echo "✓ Dependencies installed."
}


create_admin() {

    echo
    echo "[5/5] Creating admin account..."
    echo

    export HARVIX_ADMIN_USERNAME="$ADMIN_USERNAME"
    export HARVIX_ADMIN_PASSWORD="$ADMIN_PASSWORD"
    export HARVIX_DATABASE_FILE="$APP_DIR/data/harvix.json"


    node <<'NODE'

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const file = path.resolve(
    process.env.HARVIX_DATABASE_FILE
);

fs.mkdirSync(
    path.dirname(file),
    { recursive: true }
);


let db = {

    users: [],
    servers: [],
    nodes: [],

    settings: {

        server_name: "HarvixPanel",
        server_icon: ""

    },

    nextUserId: 1,
    nextServerId: 1,
    nextNodeId: 1

};


if (fs.existsSync(file)) {

    try {

        db = JSON.parse(
            fs.readFileSync(file, "utf8")
        );

    } catch {

        console.log(
            "Existing database could not be read."
        );

    }

}


if (!Array.isArray(db.users))
    db.users = [];

if (!Array.isArray(db.servers))
    db.servers = [];

if (!Array.isArray(db.nodes))
    db.nodes = [];


if (!db.settings) {

    db.settings = {

        server_name: "HarvixPanel",
        server_icon: ""

    };

}


if (!db.nextUserId)
    db.nextUserId = 1;

if (!db.nextServerId)
    db.nextServerId = 1;

if (!db.nextNodeId)
    db.nextNodeId = 1;


const username =
    process.env.HARVIX_ADMIN_USERNAME;

const password =
    process.env.HARVIX_ADMIN_PASSWORD;


if (!username || !password) {

    console.error(
        "Admin username or password missing."
    );

    process.exit(1);

}


const passwordHash =
    bcrypt.hashSync(password, 12);


const existing =
    db.users.find(
        user => user.username === username
    );


if (existing) {

    existing.role = "admin";

    existing.password_hash =
        passwordHash;

    console.log(
        "✓ Existing user converted to admin."
    );

} else {

    db.users.push({

        id: db.nextUserId++,

        username: username,

        password_hash:
            passwordHash,

        role: "admin",

        created_at:
            new Date().toISOString()

    });

    console.log(
        "✓ Admin account created."
    );

}


/*
IMPORTANT:
No default/local node is created here.

Admin must create a node from:

Admin Panel
→ Nodes
→ Add Node
*/


fs.writeFileSync(

    file,

    JSON.stringify(
        db,
        null,
        2
    )

);


console.log(
    "✓ Database saved."
);

NODE


    unset HARVIX_ADMIN_USERNAME
    unset HARVIX_ADMIN_PASSWORD
    unset HARVIX_DATABASE_FILE

    echo
}


start_panel() {

    echo
    echo "╔══════════════════════════════════╗"
    echo "║      Installation Complete       ║"
    echo "╚══════════════════════════════════╝"
    echo

    echo "Admin username: $ADMIN_USERNAME"
    echo "Panel port: $PANEL_PORT"

    echo
    echo "Panel URL:"
    echo "http://YOUR_SERVER_IP:$PANEL_PORT"

    echo
    echo "Starting HarvixPanel..."
    echo

    cd "$APP_DIR"

    npm start || true

    echo
    echo "========================================"
    echo "HarvixPanel process stopped."
    echo "========================================"
    echo

    read -rp "Press ENTER to go to main menu: " _

    show_menu
}


install_panel() {

    check_root

    echo
    echo "Installing $APP_NAME..."
    echo

    ask_admin_setup

    install_required_packages

    install_node

    download_panel

    configure_panel

    create_admin

    start_panel
}


uninstall_panel() {

    check_root

    echo
    echo "Stopping HarvixPanel..."
    echo

    if command -v systemctl >/dev/null 2>&1; then

        systemctl disable --now harvixpanel 2>/dev/null || true

    fi


    pkill -f "$APP_DIR/server.js" 2>/dev/null || true


    read -rp \
        "Delete panel files from $APP_DIR? [y/N]: " \
        CONFIRM


    if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then

        rm -rf "$APP_DIR"

        echo
        echo "✓ Panel files deleted."

    else

        echo
        echo "Panel files kept."

    fi


    echo
    echo "HarvixPanel uninstalled."

    pause_menu
}


update_panel() {

    check_root

    if [ ! -d "$APP_DIR" ]; then

        echo
        echo "HarvixPanel is not installed."
        pause_menu
        return

    fi


    echo
    echo "Updating HarvixPanel..."
    echo

    cd "$APP_DIR"

    git fetch origin
    git reset --hard origin/main

    npm install --omit=dev


    echo
    echo "✓ Update complete."

    pause_menu
}


reinstall_panel() {

    check_root

    echo
    echo "Reinstalling HarvixPanel..."
    echo


    if command -v systemctl >/dev/null 2>&1; then

        systemctl disable --now harvixpanel \
            2>/dev/null || true

    fi


    pkill -f "$APP_DIR/server.js" \
        2>/dev/null || true


    rm -rf "$APP_DIR"


    install_panel
}


node_setup() {

    check_root

    clear

    echo "========================================"
    echo "          HARVIX NODE SETUP"
    echo "========================================"
    echo

    echo "Preparing this machine for a Harvix node..."
    echo


    export DEBIAN_FRONTEND=noninteractive

    apt-get update


    if ! command -v curl >/dev/null 2>&1; then

        echo "Installing curl..."
        apt-get install -y curl

    fi


    if ! command -v openssl >/dev/null 2>&1; then

        echo "Installing openssl..."
        apt-get install -y openssl

    fi


    if ! command -v node >/dev/null 2>&1; then

        echo
        echo "Installing Node.js 20..."

        curl -fsSL \
            https://deb.nodesource.com/setup_20.x \
            | bash -

        apt-get install -y nodejs

    fi


    echo
    echo "✓ Node.js ready."
    echo "Node.js: $(node -v)"
    echo


    mkdir -p "$APP_DIR/data"


    while true; do

        echo
        read -rp \
            "Paste your node configure here: " \
            NODE_CONFIG

        if [ -n "$NODE_CONFIG" ]; then
            break
        fi

        echo
        echo "Node configuration cannot be empty."

    done


    printf '%s\n' "$NODE_CONFIG" \
        > "$APP_DIR/data/node-config"


    chmod 600 \
        "$APP_DIR/data/node-config"


    echo
    echo "✓ Node configuration saved."
    echo


    /*
    The actual node-agent is intentionally not started here.

    The panel needs a real node-agent implementation that:

    1. Reads this configuration
    2. Authenticates with the panel
    3. Starts the node service
    4. Sends heartbeat
    5. Reports ONLINE/OFFLINE
    */


    if [ -f "$APP_DIR/node-agent.js" ]; then

        echo "Starting Harvix node agent..."
        echo

        if node \
            "$APP_DIR/node-agent.js" \
            "$APP_DIR/data/node-config"
        then

            echo
            echo "Node successfully online."

        else

            echo
            echo "Node failed to start."
            echo "Please check your node."

        fi

    else

        echo
        echo "Node agent is not installed yet."
        echo
        echo "Configuration has been saved."
        echo
        echo "The node will NOT be marked ONLINE until"
        echo "the real Harvix node agent is installed."
        echo

    fi


    echo
    read -rp \
        "Press ENTER to go to main menu: " _

    show_menu
}


show_menu

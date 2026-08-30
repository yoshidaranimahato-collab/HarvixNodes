# HarvixPanel v1.0.0
Minecraft hosting panel starter.

Added server panel modules:
1. Console
2. File Manager
3. SFTP
4. Plugin Installer
5. Mod Manager
6. Votifier Test
7. Server Splitter
8. subdomain manager
9. world manager
10. player manager
11. backup
12. Settings
   

IP Alias is deliberately only a stored/displayed alias. It does not pretend to make a fake IP real and does not provide DNS, tunneling, or networking by itself. A Playit/MineKube address can be entered if you already have that address.

The real Console/File Manager/SFTP/plugin/mod operations require the node agent and Docker integration, which is the next implementation phase.

#  Manual Installation

This section contains the complete manual installation process.

You do NOT need the one-click installer if you follow these steps.

#  Install Required Packages
```bash
sudo apt install -y curl git ca-certificates
```

#  Install Node.js
``` bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
 ```
``` bash
sudo apt install -y nodejs
```

# Check the installation:
``` bash
node -v
```
```bash
 npm -v 
```

# 4️⃣ gitclone HarvixPanel
```bash
https://github.com/yoshidaranimahato-collab/HarvixPanel.git
```
 # enter the project:

 ```bash
 cd HarvixPanel
```

# install dependencies
```bash
npm install
 ```

# configure admin panel
```bash
npm run create-user
```

# example
user: admin
password: admin

# Export admin user to panel
```bash
export HARVIX_ADMIN_USERNAME="$ADMIN_USERNAME
```
   ```bash
export HARVIX_ADMIN_PASSWORD="$ADMIN_PASSWORD
```
```bash
export HARVIX_DATABASE_FILE="$APP_DIR/data/harvix.json
```

# Manual Install has some problems so use one click command installer

# one click command installer 
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/yoshidaranimahato-collab/HarvixNodes/main/installer/harvixpanel.sh)
```
 

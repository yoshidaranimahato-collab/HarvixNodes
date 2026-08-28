const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================================
// HARVIXPANEL CONFIG
// =====================================================

const CONFIG = {
    panelName: "HarvixPanel",
    panelIcon: "⚡",

    normalUser: {
        maxRamMB: 4096,
        maxDiskMB: 5120,
        maxCpu: 1
    }
};

// =====================================================
// DATABASE
// =====================================================

const users = [];
const servers = [];
const nodes = [];

// Panel settings
const panelSettings = {
    serverName: "HarvixPanel",
    serverIcon: "⚡"
};

// =====================================================
// HELPERS
// =====================================================

function generateId(prefix) {
    return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function findUser(username) {
    if (!username) return null;

    return users.find(
        user =>
            user.username.toLowerCase() ===
            username.toLowerCase()
    );
}

function findServer(id) {
    return servers.find(server => server.id === id);
}

function findNode(id) {
    return nodes.find(node => node.id === id);
}

function isAdmin(username) {
    const user = findUser(username);
    return user && user.role === "admin";
}

// =====================================================
// DEFAULT ADMIN
// =====================================================

const adminPassword =
    process.env.HARVIX_ADMIN_PASSWORD || "ChangeThisAdminPassword123!";

users.push({
    id: generateId("user"),
    username: "admin",
    password: adminPassword,
    role: "admin",
    createdAt: new Date().toISOString()
});

console.log("=================================");
console.log("       HarvixPanel");
console.log("=================================");
console.log("Default admin username: admin");
console.log("Set HARVIX_ADMIN_PASSWORD in production.");
console.log("=================================");

// =====================================================
// HEALTH
// =====================================================

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        panel: panelSettings.serverName,
        status: "online"
    });
});

// =====================================================
// PANEL SETTINGS
// =====================================================

// Get settings
app.get("/api/settings", (req, res) => {
    res.json({
        success: true,
        settings: panelSettings
    });
});

// Update settings - ADMIN ONLY
app.put("/api/admin/settings", (req, res) => {
    const { username, serverName, serverIcon } = req.body;

    if (!isAdmin(username)) {
        return res.status(403).json({
            success: false,
            error: "Admin access required."
        });
    }

    if (serverName !== undefined) {
        const name = String(serverName).trim();

        if (!name || name.length > 50) {
            return res.status(400).json({
                success: false,
                error: "Server name must be 1-50 characters."
            });
        }

        panelSettings.serverName = name;
    }

    if (serverIcon !== undefined) {
        panelSettings.serverIcon = String(serverIcon).trim();
    }

    res.json({
        success: true,
        message: "Panel settings updated.",
        settings: panelSettings
    });
});

// =====================================================
// REGISTER
// =====================================================

app.post("/api/auth/register", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            error: "Username and password are required."
        });
    }

    const cleanUsername = String(username).trim();

    if (cleanUsername.length < 3 || cleanUsername.length > 24) {
        return res.status(400).json({
            success: false,
            error: "Username must be 3-24 characters."
        });
    }

    if (String(password).length < 6) {
        return res.status(400).json({
            success: false,
            error: "Password must be at least 6 characters."
        });
    }

    if (findUser(cleanUsername)) {
        return res.status(409).json({
            success: false,
            error: "Username already exists."
        });
    }

    const user = {
        id: generateId("user"),
        username: cleanUsername,
        password: String(password),
        role: "user",
        createdAt: new Date().toISOString()
    };

    users.push(user);

    res.json({
        success: true,
        message: "Account created successfully.",
        user: {
            id: user.id,
            username: user.username,
            role: user.role
        }
    });
});

// =====================================================
// LOGIN
// =====================================================

app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;

    const user = findUser(username);

    if (!user || user.password !== String(password || "")) {
        return res.status(401).json({
            success: false,
            error: "Invalid username or password."
        });
    }

    res.json({
        success: true,
        message: "Login successful.",
        user: {
            id: user.id,
            username: user.username,
            role: user.role
        }
    });
});

// =====================================================
// USERS - ADMIN
// =====================================================

app.get("/api/admin/users", (req, res) => {
    const { username } = req.query;

    if (!isAdmin(username)) {
        return res.status(403).json({
            success: false,
            error: "Admin access required."
        });
    }

    res.json({
        success: true,
        users: users.map(user => ({
            id: user.id,
            username: user.username,
            role: user.role,
            createdAt: user.createdAt
        }))
    });
});

// =====================================================
// NODES - ADMIN
// =====================================================

// List nodes
app.get("/api/admin/nodes", (req, res) => {
    const { username } = req.query;

    if (!isAdmin(username)) {
        return res.status(403).json({
            success: false,
            error: "Admin access required."
        });
    }

    res.json({
        success: true,
        nodes
    });
});

// Create node
app.post("/api/admin/nodes", (req, res) => {
    const {
        username,
        name,
        address,
        totalRamMB,
        totalDiskMB,
        totalCpu
    } = req.body;

    if (!isAdmin(username)) {
        return res.status(403).json({
            success: false,
            error: "Admin access required."
        });
    }

    if (!name || !address) {
        return res.status(400).json({
            success: false,
            error: "Node name and address are required."
        });
    }

    const node = {
        id: generateId("node"),
        name: String(name),
        address: String(address),
        resources: {
            totalRamMB: Number(totalRamMB) || 0,
            totalDiskMB: Number(totalDiskMB) || 0,
            totalCpu: Number(totalCpu) || 0
        },
        status: "offline",
        createdAt: new Date().toISOString()
    };

    nodes.push(node);

    res.json({
        success: true,
        message: "Node created.",
        node
    });
});

// Delete node
app.delete("/api/admin/nodes/:id", (req, res) => {
    const { username } = req.body;

    if (!isAdmin(username)) {
        return res.status(403).json({
            success: false,
            error: "Admin access required."
        });
    }

    const index = nodes.findIndex(
        node => node.id === req.params.id
    );

    if (index === -1) {
        return res.status(404).json({
            success: false,
            error: "Node not found."
        });
    }

    nodes.splice(index, 1);

    res.json({
        success: true,
        message: "Node deleted."
    });
});

// =====================================================
// SERVER LIST
// =====================================================

app.get("/api/servers", (req, res) => {
    const { username } = req.query;

    const user = findUser(username);

    if (!user) {
        return res.status(401).json({
            success: false,
            error: "Authentication required."
        });
    }

    let result;

    if (user.role === "admin") {
        result = servers;
    } else {
        result = servers.filter(
            server => server.ownerId === user.id
        );
    }

    // IP Alias is ADMIN ONLY
    result = result.map(server => {
        const data = { ...server };

        if (user.role !== "admin") {
            delete data.ipAlias;
        }

        return data;
    });

    res.json({
        success: true,
        servers: result
    });
});

// =====================================================
// CREATE SERVER
// =====================================================

app.post("/api/servers", (req, res) => {
    const {
        username,
        name,
        ramMB,
        diskMB,
        cpuVcpu,
        software,
        version,
        nodeId
    } = req.body;

    const user = findUser(username);

    if (!user) {
        return res.status(401).json({
            success: false,
            error: "Authentication required."
        });
    }

    if (!name) {
        return res.status(400).json({
            success: false,
            error: "Server name is required."
        });
    }

    const ram = Number(ramMB);
    const disk = Number(diskMB);
    const cpu = Number(cpuVcpu);

    if (
        !Number.isFinite(ram) ||
        !Number.isFinite(disk) ||
        !Number.isFinite(cpu) ||
        ram <= 0 ||
        disk <= 0 ||
        cpu <= 0
    ) {
        return res.status(400).json({
            success: false,
            error: "Invalid resource values."
        });
    }

    // ================================================
    // NORMAL USER RESOURCE LIMIT
    // ================================================

    if (user.role !== "admin") {

        if (ram > CONFIG.normalUser.maxRamMB) {
            return res.status(403).json({
                success: false,
                error: "Normal users can use maximum 4 GB RAM."
            });
        }

        if (disk > CONFIG.normalUser.maxDiskMB) {
            return res.status(403).json({
                success: false,
                error: "Normal users can use maximum 5 GB disk."
            });
        }

        if (cpu > CONFIG.normalUser.maxCpu) {
            return res.status(403).json({
                success: false,
                error: "Normal users can use maximum 1 vCore."
            });
        }
    }

    // ================================================
    // NODE CHECK
    // ================================================

    if (nodeId) {
        const node = findNode(nodeId);

        if (!node) {
            return res.status(404).json({
                success: false,
                error: "Selected node not found."
            });
        }
    }

    const server = {
        id: generateId("srv"),

        name: String(name),

        ownerId: user.id,
        ownerUsername: user.username,

        nodeId: nodeId || null,

        resources: {
            ramMB: ram,
            diskMB: disk,
            cpuVcpu: cpu
        },

        software: software || "Paper",
        version: version || "1.21.4",

        status: "offline",

        // Admin only
        ipAlias: null,

        createdAt: new Date().toISOString()
    };

    servers.push(server);

    res.json({
        success: true,
        message: "Server created successfully.",
        server
    });
});

// =====================================================
// SERVER DETAILS
// =====================================================

app.get("/api/servers/:id", (req, res) => {
    const { username } = req.query;

    const user = findUser(username);
    const server = findServer(req.params.id);

    if (!user) {
        return res.status(401).json({
            success: false,
            error: "Authentication required."
        });
    }

    if (!server) {
        return res.status(404).json({
            success: false,
            error: "Server not found."
        });
    }

    if (
        user.role !== "admin" &&
        server.ownerId !== user.id
    ) {
        return res.status(403).json({
            success: false,
            error: "Access denied."
        });
    }

    const result = { ...server };

    if (user.role !== "admin") {
        delete result.ipAlias;
    }

    res.json({
        success: true,
        server: result
    });
});

// =====================================================
// SERVER START
// =====================================================

app.post("/api/servers/:id/start", (req, res) => {
    const { username } = req.body;

    const user = findUser(username);
    const server = findServer(req.params.id);

    if (!user) {
        return res.status(401).json({
            success: false,
            error: "Authentication required."
        });
    }

    if (!server) {
        return res.status(404).json({
            success: false,
            error: "Server not found."
        });
    }

    if (
        user.role !== "admin" &&
        server.ownerId !== user.id
    ) {
        return res.status(403).json({
            success: false,
            error: "Access denied."
        });
    }

    server.status = "running";

    res.json({
        success: true,
        message: "Server started.",
        status: server.status
    });
});

// =====================================================
// SERVER STOP
// =====================================================

app.post("/api/servers/:id/stop", (req, res) => {
    const { username } = req.body;

    const user = findUser(username);
    const server = findServer(req.params.id);

    if (!user) {
        return res.status(401).json({
            success: false,
            error: "Authentication required."
        });
    }

    if (!server) {
        return res.status(404).json({
            success: false,
            error: "Server not found."
        });
    }

    if (
        user.role !== "admin" &&
        server.ownerId !== user.id
    ) {
        return res.status(403).json({
            success: false,
            error: "Access denied."
        });
    }

    server.status = "offline";

    res.json({
        success: true,
        message: "Server stopped.",
        status: server.status
    });
});

// =====================================================
// SERVER RESTART
// =====================================================

app.post("/api/servers/:id/restart", (req, res) => {
    const { username } = req.body;

    const user = findUser(username);
    const server = findServer(req.params.id);

    if (!user) {
        return res.status(401).json({
            success: false,
            error: "Authentication required."
        });
    }

    if (!server) {
        return res.status(404).json({
            success: false,
            error: "Server not found."
        });
    }

    if (
        user.role !== "admin" &&
        server.ownerId !== user.id
    ) {
        return res.status(403).json({
            success: false,
            error: "Access denied."
        });
    }

    server.status = "running";

    res.json({
        success: true,
        message: "Server restarted.",
        status: server.status
    });
});

// =====================================================
// ADMIN IP ALIAS
// =====================================================

app.put("/api/servers/:id/alias", (req, res) => {
    const { username, alias_ip } = req.body;

    if (!isAdmin(username)) {
        return res.status(403).json({
            success: false,
            error: "Only administrators can manage IP Alias."
        });
    }

    const server = findServer(req.params.id);

    if (!server) {
        return res.status(404).json({
            success: false,
            error: "Server not found."
        });
    }

    server.ipAlias =
        alias_ip
            ? String(alias_ip).trim()
            : null;

    res.json({
        success: true,
        message: "IP Alias saved.",
        ipAlias: server.ipAlias
    });
});

// =====================================================
// DELETE SERVER
// =====================================================

app.delete("/api/servers/:id", (req, res) => {
    const { username } = req.body;

    const user = findUser(username);
    const server = findServer(req.params.id);

    if (!user) {
        return res.status(401).json({
            success: false,
            error: "Authentication required."
        });
    }

    if (!server) {
        return res.status(404).json({
            success: false,
            error: "Server not found."
        });
    }

    if (
        user.role !== "admin" &&
        server.ownerId !== user.id
    ) {
        return res.status(403).json({
            success: false,
            error: "Access denied."
        });
    }

    const index = servers.findIndex(
        s => s.id === server.id
    );

    servers.splice(index, 1);

    res.json({
        success: true,
        message: "Server deleted."
    });
});

// =====================================================
// FRONTEND
// =====================================================

app.use(express.static(__dirname));

app.get("*", (req, res) => {
    res.sendFile(
        path.join(__dirname, "index.html")
    );
});

// =====================================================
// START
// =====================================================

app.listen(PORT, "0.0.0.0", () => {
    console.log("=================================");
    console.log(` ${panelSettings.serverIcon} ${panelSettings.serverName}`);
    console.log("=================================");
    console.log(`Panel running on port ${PORT}`);
    console.log("Status: ONLINE");
    console.log("=================================");
});

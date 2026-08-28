const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Frontend
app.use(express.static(__dirname));

// =====================================================
// HARVIXPANEL CONFIG
// =====================================================

const CONFIG = {
    normalUser: {
        maxRamMB: 4096,   // 4 GB
        maxDiskMB: 5120,  // 5 GB
        maxCpu: 1         // 1 vCore
    }
};

// =====================================================
// TEMP DATABASE
// =====================================================
// Abhi testing ke liye memory database.
// Next phase me SQLite/PostgreSQL lagayenge.

const users = [];
const servers = [];

// =====================================================
// HELPERS
// =====================================================

function generateId(prefix) {
    return (
        prefix +
        "_" +
        crypto.randomBytes(6).toString("hex")
    );
}

function findUser(username) {
    return users.find(
        user => user.username.toLowerCase() === username.toLowerCase()
    );
}

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        panel: "HarvixPanel",
        status: "online"
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
            message: "Username and password required."
        });
    }

    if (username.length < 3) {
        return res.status(400).json({
            success: false,
            message: "Username must be at least 3 characters."
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            success: false,
            message: "Password must be at least 6 characters."
        });
    }

    if (findUser(username)) {
        return res.status(409).json({
            success: false,
            message: "Username already exists."
        });
    }

    const user = {
        id: generateId("user"),
        username,
        password,
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

    const user = findUser(username || "");

    if (!user || user.password !== password) {
        return res.status(401).json({
            success: false,
            message: "Invalid username or password."
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
// GET SERVERS
// =====================================================

app.get("/api/servers", (req, res) => {
    const username = req.query.username;

    if (!username) {
        return res.status(400).json({
            success: false,
            message: "Username required."
        });
    }

    const user = findUser(username);

    if (!user) {
        return res.status(404).json({
            success: false,
            message: "User not found."
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
        ram,
        disk,
        cpu,
        software,
        version
    } = req.body;

    if (!username || !name) {
        return res.status(400).json({
            success: false,
            message: "Username and server name required."
        });
    }

    const user = findUser(username);

    if (!user) {
        return res.status(404).json({
            success: false,
            message: "User not found."
        });
    }

    const requestedRam = Number(ram);
    const requestedDisk = Number(disk);
    const requestedCpu = Number(cpu);

    if (
        !Number.isFinite(requestedRam) ||
        !Number.isFinite(requestedDisk) ||
        !Number.isFinite(requestedCpu)
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid resource values."
        });
    }

    // =================================================
    // NORMAL USER LIMIT
    // =================================================

    if (user.role !== "admin") {

        if (requestedRam > CONFIG.normalUser.maxRamMB) {
            return res.status(403).json({
                success: false,
                message: "Maximum RAM for normal users is 4 GB."
            });
        }

        if (requestedDisk > CONFIG.normalUser.maxDiskMB) {
            return res.status(403).json({
                success: false,
                message: "Maximum disk for normal users is 5 GB."
            });
        }

        if (requestedCpu > CONFIG.normalUser.maxCpu) {
            return res.status(403).json({
                success: false,
                message: "Maximum CPU for normal users is 1 vCore."
            });
        }
    }

    const server = {
        id: generateId("srv"),
        ownerId: user.id,
        ownerUsername: user.username,

        name,

        resources: {
            ramMB: requestedRam,
            diskMB: requestedDisk,
            cpu: requestedCpu
        },

        software: software || "Paper",
        version: version || "1.21.4",

        status: "offline",

        // Admin-only field
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
    const server = servers.find(
        s => s.id === req.params.id
    );

    if (!server) {
        return res.status(404).json({
            success: false,
            message: "Server not found."
        });
    }

    res.json({
        success: true,
        server
    });
});

// =====================================================
// SERVER START
// =====================================================

app.post("/api/servers/:id/start", (req, res) => {
    const server = servers.find(
        s => s.id === req.params.id
    );

    if (!server) {
        return res.status(404).json({
            success: false,
            message: "Server not found."
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
    const server = servers.find(
        s => s.id === req.params.id
    );

    if (!server) {
        return res.status(404).json({
            success: false,
            message: "Server not found."
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
    const server = servers.find(
        s => s.id === req.params.id
    );

    if (!server) {
        return res.status(404).json({
            success: false,
            message: "Server not found."
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
// ADMIN: SET IP ALIAS
// =====================================================

app.post("/api/admin/servers/:id/ip-alias", (req, res) => {
    const { username, ipAlias } = req.body;

    const admin = findUser(username || "");

    if (!admin || admin.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Admin access required."
        });
    }

    const server = servers.find(
        s => s.id === req.params.id
    );

    if (!server) {
        return res.status(404).json({
            success: false,
            message: "Server not found."
        });
    }

    server.ipAlias = ipAlias || null;

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
    const index = servers.findIndex(
        s => s.id === req.params.id
    );

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Server not found."
        });
    }

    servers.splice(index, 1);

    res.json({
        success: true,
        message: "Server deleted."
    });
});

// =====================================================
// FRONTEND FALLBACK
// =====================================================

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// =====================================================
// START
// =====================================================

app.listen(PORT, "0.0.0.0", () => {
    console.log("=================================");
    console.log("       HarvixPanel");
    console.log("=================================");
    console.log(`Panel running on port ${PORT}`);
    console.log("Status: ONLINE");
});

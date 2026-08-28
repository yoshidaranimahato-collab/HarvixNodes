const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "harvix.db.json");

const NORMAL_LIMITS = {
  ram_mb: 4096,
  disk_mb: 5120,
  cpu_vcpu: 1
};

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

/* =========================================================
   DATABASE
   ========================================================= */

function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const adminPassword = process.env.HARVIX_ADMIN_PASSWORD || "change-me";

    const db = {
      settings: {
        server_name: "HarvixNodes",
        server_icon: "⚡"
      },

      users: [
        {
          id: 1,
          username: "admin",
          password: hashPassword(adminPassword),
          role: "admin",
          created_at: new Date().toISOString()
        }
      ],

      nodes: [],

      servers: [],

      sessions: []
    };

    saveDatabase(db);
  }
}

function loadDatabase() {
  ensureDatabase();

  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (error) {
    console.error("Database read error:", error);
    process.exit(1);
  }
}

function saveDatabase(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const temp = `${DB_FILE}.tmp`;

  fs.writeFileSync(
    temp,
    JSON.stringify(db, null, 2),
    "utf8"
  );

  fs.renameSync(temp, DB_FILE);
}

/* =========================================================
   PASSWORD / SESSION HELPERS
   ========================================================= */

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(String(password))
    .digest("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getUserFromRequest(req) {
  const auth = req.headers.authorization || "";

  if (!auth.startsWith("Bearer ")) {
    return null;
  }

  const token = auth.substring(7);

  const db = loadDatabase();

  const session = db.sessions.find(
    (x) => x.token === token
  );

  if (!session) {
    return null;
  }

  return db.users.find(
    (x) => x.id === session.user_id
  ) || null;
}

function requireAuth(req, res, next) {
  const user = getUserFromRequest(req);

  if (!user) {
    return res.status(401).json({
      error: "Authentication required"
    });
  }

  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = getUserFromRequest(req);

  if (!user) {
    return res.status(401).json({
      error: "Authentication required"
    });
  }

  if (user.role !== "admin") {
    return res.status(403).json({
      error: "Administrator access required"
    });
  }

  req.user = user;
  next();
}

/* =========================================================
   VALIDATION
   ========================================================= */

function cleanString(value, max = 200) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function validNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function serverForUser(db, serverId, user) {
  const server = db.servers.find(
    (x) => x.id === Number(serverId)
  );

  if (!server) {
    return null;
  }

  if (user.role === "admin") {
    return server;
  }

  if (server.owner_id !== user.id) {
    return null;
  }

  return server;
}

/* =========================================================
   BASIC ROUTES
   ========================================================= */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    panel: "HarvixPanel",
    version: "0.2.0"
  });
});

/* =========================================================
   AUTH
   ========================================================= */

app.post("/api/auth/register", (req, res) => {
  const username = cleanString(req.body.username, 50);
  const password = String(req.body.password || "");

  if (!username || password.length < 6) {
    return res.status(400).json({
      error: "Username and password are required. Password must be at least 6 characters."
    });
  }

  const db = loadDatabase();

  const exists = db.users.some(
    (x) => x.username.toLowerCase() === username.toLowerCase()
  );

  if (exists) {
    return res.status(409).json({
      error: "Username already exists"
    });
  }

  const user = {
    id: Date.now(),
    username,
    password: hashPassword(password),
    role: "user",
    created_at: new Date().toISOString()
  };

  db.users.push(user);
  saveDatabase(db);

  res.status(201).json({
    message: "Account created",
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
});

app.post("/api/auth/login", (req, res) => {
  const username = cleanString(req.body.username, 50);
  const password = String(req.body.password || "");

  const db = loadDatabase();

  const user = db.users.find(
    (x) =>
      x.username.toLowerCase() === username.toLowerCase()
  );

  if (!user || user.password !== hashPassword(password)) {
    return res.status(401).json({
      error: "Invalid username or password"
    });
  }

  const token = createToken();

  db.sessions = db.sessions.filter(
    (x) => x.user_id !== user.id
  );

  db.sessions.push({
    token,
    user_id: user.id,
    created_at: new Date().toISOString()
  });

  saveDatabase(db);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.substring(7);

  const db = loadDatabase();

  db.sessions = db.sessions.filter(
    (x) => x.token !== token
  );

  saveDatabase(db);

  res.json({
    message: "Logged out"
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role
  });
});

/* =========================================================
   PANEL SETTINGS
   ========================================================= */

app.get("/api/settings", requireAuth, (req, res) => {
  const db = loadDatabase();

  res.json(db.settings);
});

app.put("/api/settings", requireAdmin, (req, res) => {
  const db = loadDatabase();

  const serverName = cleanString(
    req.body.server_name,
    100
  );

  const serverIcon = cleanString(
    req.body.server_icon,
    20
  );

  if (serverName) {
    db.settings.server_name = serverName;
  }

  if (serverIcon) {
    db.settings.server_icon = serverIcon;
  }

  saveDatabase(db);

  res.json({
    message: "Settings updated",
    settings: db.settings
  });
});

/* =========================================================
   USERS - ADMIN
   ========================================================= */

app.get("/api/users", requireAdmin, (req, res) => {
  const db = loadDatabase();

  res.json(
    db.users.map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      created_at: user.created_at
    }))
  );
});

app.delete("/api/users/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);

  if (id === req.user.id) {
    return res.status(400).json({
      error: "You cannot delete your own account"
    });
  }

  const db = loadDatabase();

  const user = db.users.find(
    (x) => x.id === id
  );

  if (!user) {
    return res.status(404).json({
      error: "User not found"
    });
  }

  db.users = db.users.filter(
    (x) => x.id !== id
  );

  db.sessions = db.sessions.filter(
    (x) => x.user_id !== id
  );

  saveDatabase(db);

  res.json({
    message: "User deleted"
  });
});

/* =========================================================
   NODES - ADMIN
   ========================================================= */

app.get("/api/nodes", requireAdmin, (req, res) => {
  const db = loadDatabase();

  res.json(db.nodes);
});

app.post("/api/nodes", requireAdmin, (req, res) => {
  const name = cleanString(req.body.name, 100);
  const address = cleanString(req.body.address, 200);

  const ram = Number(req.body.ram_mb);
  const disk = Number(req.body.disk_mb);
  const cpu = Number(req.body.cpu_vcpu);

  if (!name || !address) {
    return res.status(400).json({
      error: "Node name and address are required"
    });
  }

  if (
    !validNumber(ram) ||
    !validNumber(disk) ||
    !validNumber(cpu) ||
    ram <= 0 ||
    disk <= 0 ||
    cpu <= 0
  ) {
    return res.status(400).json({
      error: "Invalid node resources"
    });
  }

  const db = loadDatabase();

  const node = {
    id: Date.now(),
    name,
    address,
    ram_mb: ram,
    disk_mb: disk,
    cpu_vcpu: cpu,
    status: "offline",
    created_at: new Date().toISOString()
  };

  db.nodes.push(node);

  saveDatabase(db);

  res.status(201).json(node);
});

app.delete("/api/nodes/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);

  const db = loadDatabase();

  const node = db.nodes.find(
    (x) => x.id === id
  );

  if (!node) {
    return res.status(404).json({
      error: "Node not found"
    });
  }

  const assignedServers = db.servers.some(
    (x) => x.node_id === id
  );

  if (assignedServers) {
    return res.status(400).json({
      error: "Cannot delete node while servers are assigned to it"
    });
  }

  db.nodes = db.nodes.filter(
    (x) => x.id !== id
  );

  saveDatabase(db);

  res.json({
    message: "Node deleted"
  });
});

/* =========================================================
   SERVERS
   ========================================================= */

app.get("/api/servers", requireAuth, (req, res) => {
  const db = loadDatabase();

  let servers;

  if (req.user.role === "admin") {
    servers = db.servers;
  } else {
    servers = db.servers.filter(
      (x) => x.owner_id === req.user.id
    );
  }

  res.json(
    servers.map((server) => ({
      ...server,

      /*
       * IP alias is intentionally admin-only.
       */
      alias_ip:
        req.user.role === "admin"
          ? server.alias_ip || ""
          : undefined
    }))
  );
});

app.get("/api/servers/:id", requireAuth, (req, res) => {
  const db = loadDatabase();

  const server = serverForUser(
    db,
    req.params.id,
    req.user
  );

  if (!server) {
    return res.status(404).json({
      error: "Server not found"
    });
  }

  const result = {
    ...server
  };

  if (req.user.role !== "admin") {
    delete result.alias_ip;
  }

  res.json(result);
});

/* =========================================================
   CREATE SERVER
   ========================================================= */

app.post("/api/servers", requireAuth, (req, res) => {
  const name = cleanString(req.body.name, 100);

  const ram = Number(req.body.ram_mb);
  const disk = Number(req.body.disk_mb);
  const cpu = Number(req.body.cpu_vcpu);

  const software = cleanString(
    req.body.software,
    30
  );

  const version = cleanString(
    req.body.version,
    30
  );

  if (!name || !software || !version) {
    return res.status(400).json({
      error: "Name, software and version are required"
    });
  }

  if (
    !validNumber(ram) ||
    !validNumber(disk) ||
    !validNumber(cpu)
  ) {
    return res.status(400).json({
      error: "Invalid resource values"
    });
  }

  if (ram <= 0 || disk <= 0 || cpu <= 0) {
    return res.status(400).json({
      error: "Resources must be greater than zero"
    });
  }

  /*
   * Normal users are restricted here on the SERVER side.
   * This cannot be bypassed by changing the HTML.
   */
  if (req.user.role !== "admin") {
    if (ram > NORMAL_LIMITS.ram_mb) {
      return res.status(400).json({
        error: "Normal users can use a maximum of 4096 MB RAM"
      });
    }

    if (disk > NORMAL_LIMITS.disk_mb) {
      return res.status(400).json({
        error: "Normal users can use a maximum of 5120 MB disk"
      });
    }

    if (cpu > NORMAL_LIMITS.cpu_vcpu) {
      return res.status(400).json({
        error: "Normal users can use a maximum of 1 vCPU"
      });
    }
  }

  const allowedSoftware = [
    "Paper",
    "Vanilla",
    "Fabric",
    "Forge"
  ];

  if (!allowedSoftware.includes(software)) {
    return res.status(400).json({
      error: "Unsupported software"
    });
  }

  const db = loadDatabase();

  /*
   * Select the first node with enough configured resources.
   * This is allocation metadata only; real resource enforcement
   * requires a Node Agent/container runtime.
   */
  let selectedNode = null;

  for (const node of db.nodes) {
    if (node.status === "offline") {
      continue;
    }

    const usedRam = db.servers
      .filter((s) => s.node_id === node.id)
      .reduce((sum, s) => sum + s.ram_mb, 0);

    const usedDisk = db.servers
      .filter((s) => s.node_id === node.id)
      .reduce((sum, s) => sum + s.disk_mb, 0);

    const usedCpu = db.servers
      .filter((s) => s.node_id === node.id)
      .reduce((sum, s) => sum + s.cpu_vcpu, 0);

    if (
      usedRam + ram <= node.ram_mb &&
      usedDisk + disk <= node.disk_mb &&
      usedCpu + cpu <= node.cpu_vcpu
    ) {
      selectedNode = node;
      break;
    }
  }

  const server = {
    id: Date.now(),
    name,
    owner_id: req.user.id,
    node_id: selectedNode ? selectedNode.id : null,

    ram_mb: ram,
    disk_mb: disk,
    cpu_vcpu: cpu,

    software,
    version,

    status: "stopped",

    alias_ip: "",

    created_at: new Date().toISOString()
  };

  db.servers.push(server);

  saveDatabase(db);

  const result = {
    ...server
  };

  if (req.user.role !== "admin") {
    delete result.alias_ip;
  }

  res.status(201).json(result);
});

/* =========================================================
   SERVER START / STOP / RESTART
   ========================================================= */

function changeServerStatus(req, res, status) {
  const db = loadDatabase();

  const server = serverForUser(
    db,
    req.params.id,
    req.user
  );

  if (!server) {
    return res.status(404).json({
      error: "Server not found"
    });
  }

  /*
   * This changes panel state only.
   * A real Minecraft process controller/Node Agent
   * must be connected for actual server start/stop.
   */

  server.status = status;
  server.updated_at = new Date().toISOString();

  saveDatabase(db);

  res.json({
    message: `Server ${status}`,
    server
  });
}

app.post(
  "/api/servers/:id/start",
  requireAuth,
  (req, res) => changeServerStatus(req, res, "running")
);

app.post(
  "/api/servers/:id/stop",
  requireAuth,
  (req, res) => changeServerStatus(req, res, "stopped")
);

app.post(
  "/api/servers/:id/restart",
  requireAuth,
  (req, res) => changeServerStatus(req, res, "restarting")
);

/* =========================================================
   IP ALIAS - ADMIN ONLY
   ========================================================= */

app.put(
  "/api/servers/:id/alias",
  requireAdmin,
  (req, res) => {
    const db = loadDatabase();

    const server = db.servers.find(
      (x) => x.id === Number(req.params.id)
    );

    if (!server) {
      return res.status(404).json({
        error: "Server not found"
      });
    }

    const alias = cleanString(
      req.body.alias_ip,
      200
    );

    if (alias.length > 200) {
      return res.status(400).json({
        error: "Alias is too long"
      });
    }

    server.alias_ip = alias;
    server.updated_at = new Date().toISOString();

    saveDatabase(db);

    res.json({
      message: "IP Alias saved",
      alias_ip: server.alias_ip
    });
  }
);

/* =========================================================
   SERVER SETTINGS
   ========================================================= */

app.put(
  "/api/servers/:id/software",
  requireAuth,
  (req, res) => {
    const db = loadDatabase();

    const server = serverForUser(
      db,
      req.params.id,
      req.user
    );

    if (!server) {
      return res.status(404).json({
        error: "Server not found"
      });
    }

    const software = cleanString(
      req.body.software,
      30
    );

    const allowed = [
      "Paper",
      "Vanilla",
      "Fabric",
      "Forge"
    ];

    if (!allowed.includes(software)) {
      return res.status(400).json({
        error: "Unsupported software"
      });
    }

    server.software = software;
    server.updated_at = new Date().toISOString();

    saveDatabase(db);

    res.json({
      message: "Software changed",
      server
    });
  }
);

app.put(
  "/api/servers/:id/version",
  requireAuth,
  (req, res) => {
    const db = loadDatabase();

    const server = serverForUser(
      db,
      req.params.id,
      req.user
    );

    if (!server) {
      return res.status(404).json({
        error: "Server not found"
      });
    }

    const version = cleanString(
      req.body.version,
      30
    );

    if (!version) {
      return res.status(400).json({
        error: "Version is required"
      });
    }

    server.version = version;
    server.updated_at = new Date().toISOString();

    saveDatabase(db);

    res.json({
      message: "Version changed",
      server
    });
  }
);

/* =========================================================
   REINSTALL
   ========================================================= */

app.post(
  "/api/servers/:id/reinstall",
  requireAuth,
  (req, res) => {
    const db = loadDatabase();

    const server = serverForUser(
      db,
      req.params.id,
      req.user
    );

    if (!server) {
      return res.status(404).json({
        error: "Server not found"
      });
    }

    server.status = "reinstalling";
    server.updated_at = new Date().toISOString();

    saveDatabase(db);

    res.json({
      message:
        "Reinstall requested. A Node Agent is required to perform the actual Minecraft reinstall.",
      server
    });
  }
);

/* =========================================================
   SERVER MODULES
   ========================================================= */

const modules = [
  "console",
  "file-manager",
  "sftp",
  "plugin-installer",
  "mod-manager",
  "votifier",
  "server-splitter"
];

for (const moduleName of modules) {
  app.get(
    `/api/servers/:id/${moduleName}`,
    requireAuth,
    (req, res) => {
      const db = loadDatabase();

      const server = serverForUser(
        db,
        req.params.id,
        req.user
      );

      if (!server) {
        return res.status(404).json({
          error: "Server not found"
        });
      }

      res.json({
        server_id: server.id,
        module: moduleName,
        status: "not_connected",
        message:
          `The ${moduleName} module requires the Harvix Node Agent.`
      });
    }
  );
}

/* =========================================================
   DELETE SERVER
   ========================================================= */

app.delete(
  "/api/servers/:id",
  requireAuth,
  (req, res) => {
    const db = loadDatabase();

    const server = serverForUser(
      db,
      req.params.id,
      req.user
    );

    if (!server) {
      return res.status(404).json({
        error: "Server not found"
      });
    }

    db.servers = db.servers.filter(
      (x) => x.id !== server.id
    );

    saveDatabase(db);

    res.json({
      message: "Server removed from panel"
    });
  }
);

/* =========================================================
   404
   ========================================================= */

app.use("/api", (req, res) => {
  res.status(404).json({
    error: "API endpoint not found"
  });
})

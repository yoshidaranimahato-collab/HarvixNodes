require("dotenv").config();

const express = require("express");
const path = require("path");

const { db, save } = require("./src/database");
const { register, login } = require("./src/auth");
const { auth, admin } = require("./src/middleware");
const { validateLimits } = require("./src/server-manager");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    panel: "HarvixPanel",
    version: "0.3.0"
  });
});

/* =========================
   AUTH
========================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const result = await register(
      req.body.username,
      req.body.password
    );

    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const result = await login(
      req.body.username,
      req.body.password
    );

    res.json(result);
  } catch (error) {
    res.status(401).json({
      error: error.message
    });
  }
});

app.get("/api/auth/me", auth, (req, res) => {
  const user = db.users.find(
    user => user.id === req.user.id
  );

  if (!user) {
    return res.status(401).json({
      error: "User not found."
    });
  }

  res.json({
    id: user.id,
    username: user.username,
    role: user.role
  });
});

/* =========================
   SERVERS
========================= */

app.get("/api/servers", auth, (req, res) => {
  const servers = db.servers
    .filter(server =>
      req.user.role === "admin" ||
      server.owner_id === req.user.id
    )
    .map(server => {
      if (req.user.role === "admin") {
        return server;
      }

      const copy = { ...server };
      delete copy.alias_ip;

      return copy;
    });

  res.json(servers);
});

app.post("/api/servers", auth, (req, res) => {
  try {
    const resources = validateLimits(
      req.body,
      req.user.role === "admin"
    );

    const name = String(
      req.body.name || ""
    ).trim();

    if (!name) {
      throw new Error("Server name is required.");
    }

    const server = {
      id: db.nextServerId++,
      owner_id: req.user.id,

      name,

      ram_mb: resources.ram,
      disk_mb: resources.disk,
      cpu_vcpu: resources.cpu,

      software: String(
        req.body.software || "Paper"
      ),

      version: String(
        req.body.version || "1.21.4"
      ),

      node_id: null,

      alias_ip: "",

      status: "stopped",

      created_at: new Date().toISOString()
    };

    db.servers.push(server);
    save();

    res.json(server);

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

/* =========================
   SERVER DETAILS
========================= */

app.get("/api/servers/:id", auth, (req, res) => {
  const server = db.servers.find(
    server => server.id == req.params.id
  );

  if (!server) {
    return res.status(404).json({
      error: "Server not found."
    });
  }

  if (
    req.user.role !== "admin" &&
    server.owner_id !== req.user.id
  ) {
    return res.status(403).json({
      error: "Access denied."
    });
  }

  if (req.user.role === "admin") {
    return res.json(server);
  }

  const copy = { ...server };
  delete copy.alias_ip;

  res.json(copy);
});

/* =========================
   SERVER ACTIONS
========================= */

const actions = [
  "start",
  "stop",
  "restart",
  "reinstall"
];

for (const action of actions) {

  app.post(
    `/api/servers/:id/${action}`,
    auth,
    (req, res) => {

      const server = db.servers.find(
        server => server.id == req.params.id
      );

      if (!server) {
        return res.status(404).json({
          error: "Server not found."
        });
      }

      if (
        req.user.role !== "admin" &&
        server.owner_id !== req.user.id
      ) {
        return res.status(403).json({
          error: "Access denied."
        });
      }

      if (action === "start") {
        server.status = "running";
      }

      if (action === "stop") {
        server.status = "stopped";
      }

      if (action === "restart") {
        server.status = "restarting";
      }

      if (action === "reinstall") {
        server.status = "reinstalling";
      }

      save();

      res.json({
        ok: true,
        server,
        message:
          "Node-agent execution is not connected yet."
      });
    }
  );
}

/* =========================
   VERSION
========================= */

app.put(
  "/api/servers/:id/version",
  auth,
  (req, res) => {

    const server = db.servers.find(
      server => server.id == req.params.id
    );

    if (!server) {
      return res.status(404).json({
        error: "Server not found."
      });
    }

    if (
      req.user.role !== "admin" &&
      server.owner_id !== req.user.id
    ) {
      return res.status(403).json({
        error: "Access denied."
      });
    }

    const version = String(
      req.body.version || ""
    ).trim();

    if (!version) {
      return res.status(400).json({
        error: "Version is required."
      });
    }

    server.version = version;

    save();

    res.json(server);
  }
);

/* =========================
   SOFTWARE
========================= */

app.put(
  "/api/servers/:id/software",
  auth,
  (req, res) => {

    const server = db.servers.find(
      server => server.id == req.params.id
    );

    if (!server) {
      return res.status(404).json({
        error: "Server not found."
      });
    }

    if (
      req.user.role !== "admin" &&
      server.owner_id !== req.user.id
    ) {
      return res.status(403).json({
        error: "Access denied."
      });
    }

    const software = String(
      req.body.software || "Paper"
    );

    server.software = software;

    save();

    res.json(server);
  }
);

/* =========================
   IP ALIAS
   ADMIN ONLY
========================= */

app.put(
  "/api/servers/:id/alias",
  auth,
  admin,
  (req, res) => {

    const server = db.servers.find(
      server => server.id == req.params.id
    );

    if (!server) {
      return res.status(404).json({
        error: "Server not found."
      });
    }

    server.alias_ip = String(
      req.body.alias_ip || ""
    ).trim();

    save();

    res.json({
      ok: true,
      alias_ip: server.alias_ip
    });
  }
);

/* =========================
   ADMIN SETTINGS
========================= */

app.get(
  "/api/settings",
  auth,
  admin,
  (req, res) => {
    res.json(db.settings);
  }
);

app.put(
  "/api/settings",
  auth,
  admin,
  (req, res) => {

    db.settings.server_name =
      String(
        req.body.server_name ||
        "HarvixPanel"
      );

    db.settings.server_icon =
      String(
        req.body.server_icon ||
        "⚡"
      );

    save();

    res.json(db.settings);
  }
);

/* =========================
   ADMIN NODES
========================= */

app.get(
  "/api/nodes",
  auth,
  admin,
  (req, res) => {
    res.json(db.nodes);
  }
);

app.post(
  "/api/nodes",
  auth,
  admin,
  (req, res) => {

    const node = {
      id: db.nextNodeId++,

      name: String(
        req.body.name || "Node"
      ),

      address: String(
        req.body.address || ""
      ),

      ram_mb: Number(
        req.body.ram_mb || 0
      ),

      disk_mb: Number(
        req.body.disk_mb || 0
      ),

      cpu_vcpu: Number(
        req.body.cpu_vcpu || 0
      ),

      status: "offline"
    };

    db.nodes.push(node);

    save();

    res.json(node);
  }
);

/* =========================
   ADMIN USERS
========================= */

app.get(
  "/api/users",
  auth,
  admin,
  (req, res) => {

    res.json(
      db.users.map(user => ({
        id: user.id,
        username: user.username,
        role: user.role,
        created_at: user.created_at
      }))
    );
  }
);

/* =========================
   SERVER MODULES
========================= */

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
    auth,
    (req, res) => {

      const server = db.servers.find(
        server => server.id == req.params.id
      );

      if (!server) {
        return res.status(404).json({
          error: "Server not found."
        });
      }

      if (
        req.user.role !== "admin" &&
        server.owner_id !== req.user.id
      ) {
        return res.status(403).json({
          error: "Access denied."
        });
      }

      res.json({
        ok: true,
        module: moduleName,
        message:
          "Module endpoint is ready. Connect the node-agent for real operations."
      });
    }
  );
}

/* =========================
   FRONTEND
========================= */

app.get("*", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

/* =========================
   START
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `HarvixPanel running on port ${PORT}`
    );
  }
);

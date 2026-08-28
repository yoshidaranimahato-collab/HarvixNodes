const express = require("express");
const path = require("path");
const fs = require("fs");

const {
  db,
  save
} = require("./src/database");

const {
  register,
  login
} = require("./src/auth");

const {
  auth,
  admin
} = require("./src/middleware");

const {
  validateLimits,
  checkNodeCapacity,
  calculateNodeUsage
} = require("./src/server-manager");

const {
  ensureDefaultNode,
  getNodeStatus
} = require("./src/node-agent");

const app = express();

const PORT =
  Number(process.env.PORT) || 6969;


/* =========================
   BASIC CONFIG
========================= */

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb"
  })
);


/* =========================
   DATA DIRECTORY
========================= */

fs.mkdirSync(
  path.join(__dirname, "data"),
  {
    recursive: true
  }
);


/* =========================
   DEFAULT NODE
========================= */

ensureDefaultNode();


/* =========================
   FRONTEND
========================= */

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);


/* =========================
   HEALTH CHECK
========================= */

app.get(
  "/api/health",
  (req, res) => {

    res.json({
      ok: true,
      panel: "HarvixPanel",
      version: "1.0.0",
      port: PORT,
      time:
        new Date().toISOString()
    });

  }
);


/* =========================
   AUTH
========================= */

app.post(
  "/api/auth/register",
  async (req, res) => {

    try {

      const user =
        await register(
          req.body.username,
          req.body.password
        );

      res.status(201).json(
        user
      );

    } catch (error) {

      res.status(400).json({
        error:
          error.message
      });

    }

  }
);


app.post(
  "/api/auth/login",
  async (req, res) => {

    try {

      const result =
        await login(
          req.body.username,
          req.body.password
        );

      res.json(result);

    } catch (error) {

      res.status(401).json({
        error:
          error.message
      });

    }

  }
);


/*
 * Current logged-in user
 */

app.get(
  "/api/auth/me",
  auth,
  (req, res) => {

    const user =
      db.users.find(
        u => u.id === req.user.id
      );

    if (!user) {

      return res
        .status(404)
        .json({
          error:
            "User not found."
        });

    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role
    });

  }
);


/* =========================
   SERVER LIST
========================= */

app.get(
  "/api/servers",
  auth,
  (req, res) => {

    const servers =
      req.user.role === "admin"

        ? db.servers

        : db.servers.filter(
            server =>
              server.owner_id ===
              req.user.id
          );

    res.json(
      servers.map(
        server => {

          /*
           * IP alias is admin-only.
           */

          if (
            req.user.role !==
            "admin"
          ) {

            const copy = {
              ...server
            };

            delete copy.alias_ip;

            return copy;

          }

          return server;

        }
      )
    );

  }
);


/* =========================
   GET ONE SERVER
========================= */

app.get(
  "/api/servers/:id",
  auth,
  (req, res) => {

    const id =
      Number(req.params.id);

    const server =
      db.servers.find(
        s => s.id === id
      );

    if (!server) {

      return res
        .status(404)
        .json({
          error:
            "Server not found."
        });

    }

    if (
      req.user.role !== "admin" &&
      server.owner_id !== req.user.id
    ) {

      return res
        .status(403)
        .json({
          error:
            "You do not own this server."
        });

    }

    const result = {
      ...server
    };

    if (
      req.user.role !==
      "admin"
    ) {

      delete result.alias_ip;

    }

    res.json(result);

  }
);


/* =========================
   CREATE SERVER
========================= */

app.post(
  "/api/servers",
  auth,
  (req, res) => {

    try {

      const {
        name,
        software,
        version
      } = req.body;

      if (
        !name ||
        !String(name).trim()
      ) {

        return res
          .status(400)
          .json({
            error:
              "Server name is required."
          });

      }

      const resources =
        validateLimits(
          req.body,
          req.user.role ===
            "admin"
        );

      const node =
        ensureDefaultNode();

      /*
       * Convert configured node
       * capacity into MB.
       */

      const nodeCapacity = {

        ...node,

        ram_mb:
          Number(node.ram_gb) *
          1024,

        disk_mb:
          Number(node.disk_tb) *
          1024 *
          1024,

        cpu_vcpu:
          Number(node.cpu_vcores)

      };

      const serverForCapacity = {

        ram_mb:
          resources.ram,

        disk_mb:
          resources.disk,

        cpu_vcpu:
          resources.cpu

      };

      /*
       * Note:
       * The configured default node has
       * very large virtual capacity.
       */

      if (
        !checkNodeCapacity(
          serverForCapacity,
          {
            ...nodeCapacity,
            ...calculateUsageForNode(
              node.id
            )
          }
        )
      ) {

        return res
          .status(400)
          .json({
            error:
              "Not enough node capacity."
          });

      }

      const server = {

        id:
          db.nextServerId++,

        name:
          String(name).trim(),

        owner_id:
          req.user.id,

        node_id:
          node.id,

        ram_mb:
          resources.ram,

        disk_mb:
          resources.disk,

        cpu_vcpu:
          resources.cpu,

        software:
          software ||
          "Paper",

        version:
          version ||
          "1.21.4",

        status:
          "stopped",

        alias_ip:
          "",

        created_at:
          new Date().toISOString()

      };

      db.servers.push(
        server
      );

      save();

      res.status(201).json(
        server
      );

    } catch (error) {

      res.status(400).json({
        error:
          error.message
      });

    }

  }
);


/* =========================
   NODE USAGE HELPER
========================= */

function calculateUsageForNode(
  nodeId
) {

  const usage =
    calculateNodeUsage(
      db.servers,
      nodeId
    );

  return {
    used_ram_mb:
      usage.ram,

    used_disk_mb:
      usage.disk,

    used_cpu_vcpu:
      usage.cpu
  };

}


/* =========================
   SERVER ACCESS HELPER
========================= */

function getOwnedServer(
  req,
  res
) {

  const id =
    Number(req.params.id);

  const server =
    db.servers.find(
      s => s.id === id
    );

  if (!server) {

    res.status(404).json({
      error:
        "Server not found."
    });

    return null;
  }

  if (
    req.user.role !== "admin" &&
    server.owner_id !== req.user.id
  ) {

    res.status(403).json({
      error:
        "You do not own this server."
    });

    return null;
  }

  return server;

}


/* =========================
   START
========================= */

app.post(
  "/api/servers/:id/start",
  auth,
  (req, res) => {

    const server =
      getOwnedServer(
        req,
        res
      );

    if (!server) return;

    server.status =
      "running";

    save();

    res.json({
      success: true,
      status:
        server.status
    });

  }
);


/* =========================
   STOP
========================= */

app.post(
  "/api/servers/:id/stop",
  auth,
  (req, res) => {

    const server =
      getOwnedServer(
        req,
        res
      );

    if (!server) return;

    server.status =
      "stopped";

    save();

    res.json({
      success: true,
      status:
        server.status
    });

  }
);


/* =========================
   RESTART
========================= */

app.post(
  "/api/servers/:id/restart",
  auth,
  (req, res) => {

    const server =
      getOwnedServer(
        req,
        res
      );

    if (!server) return;

    server.status =
      "running";

    save();

    res.json({
      success: true,
      status:
        server.status
    });

  }
);


/* =========================
   REINSTALL
========================= */

app.post(
  "/api/servers/:id/reinstall",
  auth,
  (req, res) => {

    const server =
      getOwnedServer(
        req,
        res
      );

    if (!server) return;

    /*
     * This currently resets the
     * server's management state.
     *
     * A real Minecraft node-agent
     * will later perform the actual
     * filesystem/world reinstall.
     */

    server.status =
      "stopped";

    server.reinstall_requested =
      true;

    server.reinstall_requested_at =
      new Date().toISOString();

    save();

    res.json({
      success: true,
      message:
        "Reinstall request created."
    });

  }
);


/* =========================
   CHANGE VERSION
========================= */

app.put(
  "/api/servers/:id/version",
  auth,
  (req, res) => {

    const server =
      getOwnedServer(
        req,
        res
      );

    if (!server) return;

    const version =
      String(
        req.body.version || ""
      ).trim();

    if (!version) {

      return res
        .status(400)
        .json({
          error:
            "Version is required."
        });

    }

    server.version =
      version;

    save();

    res.json({
      success: true,
      version
    });

  }
);


/* =========================
   CHANGE SOFTWARE
========================= */

app.put(
  "/api/servers/:id/software",
  auth,
  (req, res) => {

    const server =
      getOwnedServer(
        req,
        res
      );

    if (!server) return;

    const allowed = [
      "Paper",
      "Vanilla",
      "Fabric",
      "Forge"
    ];

    const software =
      String(
        req.body.software || ""
      );

    if (
      !allowed.includes(
        software
      )
    ) {

      return res
        .status(400)
        .json({
          error:
            "Unsupported software."
        });

    }

    server.software =
      software;

    save();

    res.json({
      success: true,
      software
    });

  }
);


/* =========================
   IP ALIAS
========================= */

app.put(
  "/api/servers/:id/alias",
  auth,
  admin,
  (req, res) => {

    const id =
      Number(req.params.id);

    const server =
      db.servers.find(
        s => s.id === id
      );

    if (!server) {

      return res
        .status(404)
        .json({
          error:
            "Server not found."
        });

    }

    const alias =
      String(
        req.body.alias_ip || ""
      ).trim();

    if (
      alias.length > 255
    ) {

      return res
        .status(400)
        .json({
          error:
            "Alias is too long."
        });

    }

    server.alias_ip =
      alias;

    save();

    res.json({
      success: true,
      alias_ip:
        server.alias_ip
    });

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


for (
  const moduleName of modules
) {

  app.get(
    `/api/servers/:id/${moduleName}`,
    auth,
    (req, res) => {

      const server =
        getOwnedServer(
          req,
          res
        );

      if (!server) return;

      res.json({

        success: true,

        server_id:
          server.id,

        module:
          moduleName,

        status:
          server.status,

        message:
          `${moduleName} API is ready for node-agent integration.`

      });

    }
  );

}


/* =========================
   ADMIN: USERS
========================= */

app.get(
  "/api/users",
  auth,
  admin,
  (req, res) => {

    res.json(
      db.users.map(
        user => ({
          id:
            user.id,

          username:
            user.username,

          role:
            user.role,

          created_at:
            user.created_at
        })
      )
    );

  }
);


/* =========================
   ADMIN: NODES
========================= */

app.get(
  "/api/nodes",
  auth,
  admin,
  (req, res) => {

    const nodes =
      db.nodes.map(
        node => {

          const usage =
            calculateNodeUsage(
              db.servers,
              node.id
            );

          return {

            ...node,

            used_ram_mb:
              usage.ram,

            used_disk_mb:
              usage.disk,

            used_cpu_vcpu:
              usage.cpu

          };

        }
      );

    res.json(nodes);

  }
);


/* =========================
   NODE STATUS
========================= */

app.get(
  "/api/node",
  auth,
  (req, res) => {

    res.json(
      getNodeStatus()
    );

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

    res.json(
      db.settings
    );

  }
);


app.put(
  "/api/settings",
  auth,
  admin,
  (req, res) => {

    if (
      typeof req.body.server_name ===
      "string"
    ) {

      const name =
        req.body.server_name
          .trim();

      if (name.length > 0) {

        db.settings.server_name =
          name;

      }

    }

    if (
      typeof req.body.server_icon ===
      "string"
    ) {

      db.settings.server_icon =
        req.body.server_icon;

    }

    save();

    res.json(
      db.settings
    );

  }
);


/* =========================
   404 API
========================= */

app.use(
  "/api",
  (req, res) => {

    res.status(404).json({
      error:
        "API endpoint not found."
    });

  }
);


/* =========================
   FRONTEND FALLBACK
========================= */

app.get(
  "*splat",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );

  }
);


/* =========================
   ERROR HANDLER
========================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      error
    );

    res.status(500).json({
      error:
        "Internal server error."
    });

  }
);


/* =========================
   START SERVER
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "=================================="
    );

    console.log(
      "        HarvixPanel"
    );

    console.log(
      "=================================="
    );

    console.log(
      `Panel running on port ${PORT}`
    );

    console.log(
      `http://0.0.0.0:${PORT}`
    );

    console.log(
      "Default node: HarvixNode-1"
    );

    console.log(
      "Node status: ONLINE"
    );

    console.log(
      "=================================="
    );

  }
);

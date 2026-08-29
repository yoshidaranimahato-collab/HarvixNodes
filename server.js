const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

/* =========================
   CONFIG
========================= */

const PORT = Number(process.env.PORT) || 6969;

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "harvixpanel-change-this-secret";

const DATABASE_FILE =
  process.env.DATABASE_FILE ||
  path.join(
    __dirname,
    "data",
    "harvix.json"
  );

const PUBLIC_DIR =
  path.join(
    __dirname,
    "public"
  );


/* =========================
   MIDDLEWARE
========================= */

app.use(
  express.json()
);

app.use(
  express.urlencoded({
    extended: true
  })
);


/* =========================
   DATABASE
========================= */

function createEmptyDatabase() {
  return {
    users: [],
    servers: [],
    nodes: [],
    nextUserId: 1,
    nextServerId: 1,
    nextNodeId: 1
  };
}


function ensureDatabase() {

  const databaseDir =
    path.dirname(
      DATABASE_FILE
    );

  fs.mkdirSync(
    databaseDir,
    {
      recursive: true
    }
  );

  if (
    !fs.existsSync(
      DATABASE_FILE
    )
  ) {

    fs.writeFileSync(
      DATABASE_FILE,
      JSON.stringify(
        createEmptyDatabase(),
        null,
        2
      )
    );

  }

}


function readDatabase() {

  ensureDatabase();

  try {

    const raw =
      fs.readFileSync(
        DATABASE_FILE,
        "utf8"
      );

    const database =
      JSON.parse(raw);

    if (!database.users)
      database.users = [];

    if (!database.servers)
      database.servers = [];

    if (!database.nodes)
      database.nodes = [];

    if (!database.nextUserId)
      database.nextUserId = 1;

    if (!database.nextServerId)
      database.nextServerId = 1;

    if (!database.nextNodeId)
      database.nextNodeId = 1;

    return database;

  } catch (error) {

    console.error(
      "Database read error:",
      error
    );

    return createEmptyDatabase();

  }

}


function saveDatabase(database) {

  ensureDatabase();

  fs.writeFileSync(
    DATABASE_FILE,
    JSON.stringify(
      database,
      null,
      2
    )
  );

}


/* =========================
   JWT
========================= */

function createToken(user) {

  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );

}


function authenticate(
  req,
  res,
  next
) {

  const header =
    req.headers.authorization;

  if (
    !header ||
    !header.startsWith(
      "Bearer "
    )
  ) {

    return res.status(401).json({
      success: false,
      message:
        "Authentication required."
    });

  }

  const token =
    header.substring(7);

  try {

    req.user =
      jwt.verify(
        token,
        JWT_SECRET
      );

    next();

  } catch (error) {

    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired token."
    });

  }

}


/* =========================
   REGISTER
========================= */

app.post(
  "/api/register",
  async (req, res) => {

    try {

      const username =
        String(
          req.body.username || ""
        ).trim();

      const password =
        String(
          req.body.password || ""
        );

      if (
        !username ||
        !password
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Username and password are required."
        });

      }

      if (
        username.length < 3
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Username must contain at least 3 characters."
        });

      }

      if (
        password.length < 6
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Password must contain at least 6 characters."
        });

      }

      const database =
        readDatabase();

      const existingUser =
        database.users.find(
          user =>
            String(
              user.username
            ).toLowerCase() ===
            username.toLowerCase()
        );

      if (existingUser) {

        return res.status(409).json({
          success: false,
          message:
            "Username already exists."
        });

      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const user = {

        id:
          database.nextUserId++,

        username,

        password_hash:
          passwordHash,

        role:
          "user",

        created_at:
          new Date().toISOString()

      };

      database.users.push(
        user
      );

      saveDatabase(
        database
      );

      const token =
        createToken(user);

      return res.status(201).json({

        success: true,

        message:
          "Account created successfully.",

        token,

        user: {
          id: user.id,
          username:
            user.username,
          role:
            user.role
        }

      });

    } catch (error) {

      console.error(
        "Register error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to create account."
      });

    }

  }
);


/* =========================
   LOGIN
========================= */

app.post(
  "/api/login",
  async (req, res) => {

    try {

      const username =
        String(
          req.body.username || ""
        ).trim();

      const password =
        String(
          req.body.password || ""
        );

      if (
        !username ||
        !password
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Username and password are required."
        });

      }

      const database =
        readDatabase();

      const user =
        database.users.find(
          account =>
            String(
              account.username
            ).toLowerCase() ===
            username.toLowerCase()
        );

      if (!user) {

        return res.status(401).json({
          success: false,
          message:
            "Invalid username or password."
        });

      }

      const passwordHash =
        user.password_hash ||
        user.passwordHash ||
        user.password;

      if (!passwordHash) {

        return res.status(401).json({
          success: false,
          message:
            "Account password is not configured."
        });

      }

      const passwordCorrect =
        await bcrypt.compare(
          password,
          passwordHash
        );

      if (!passwordCorrect) {

        return res.status(401).json({
          success: false,
          message:
            "Invalid username or password."
        });

      }

      const token =
        createToken(user);

      return res.json({

        success: true,

        message:
          "Login successful.",

        token,

        user: {
          id: user.id,
          username:
            user.username,
          role:
            user.role
        }

      });

    } catch (error) {

      console.error(
        "Login error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to login."
      });

    }

  }
);


/* =========================
   CURRENT USER
========================= */

app.get(
  "/api/auth/me",
  authenticate,
  (req, res) => {

    const database =
      readDatabase();

    const user =
      database.users.find(
        account =>
          account.id ===
          req.user.id
      );

    if (!user) {

      return res.status(404).json({
        success: false,
        message:
          "User not found."
      });

    }

    return res.json({

      success: true,

      user: {
        id: user.id,
        username:
          user.username,
        role:
          user.role
      }

    });

  }
);


/* =========================
   LOGOUT
========================= */

app.post(
  "/api/auth/logout",
  (req, res) => {

    res.json({

      success: true,

      message:
        "Logged out successfully."

    });

  }
);


/* =========================
   HEALTH CHECK
========================= */

app.get(
  "/api/health",
  (req, res) => {

    res.json({

      success: true,

      panel:
        "HarvixPanel",

      status:
        "online",

      port:
        PORT

    });

  }
);


/* =========================
   ADMIN CHECK
========================= */

app.get(
  "/api/admin",
  authenticate,
  (req, res) => {

    if (
      req.user.role !==
      "admin"
    ) {

      return res.status(403).json({
        success: false,
        message:
          "Admin access required."
      });

    }

    return res.json({

      success: true,

      message:
        "Welcome to HarvixPanel Admin.",

      user:
        req.user

    });

  }
);


/* =========================
   SERVER LIST
========================= */

app.get(
  "/api/servers",
  authenticate,
  (req, res) => {

    const database =
      readDatabase();

    const servers =
      database.servers.filter(
        server =>
          server.user_id ===
          req.user.id ||
          req.user.role ===
          "admin"
      );

    res.json({

      success: true,

      servers

    });

  }
);


/* =========================
   NODE LIST
========================= */

app.get(
  "/api/nodes",
  authenticate,
  (req, res) => {

    const database =
      readDatabase();

    res.json({

      success: true,

      nodes:
        database.nodes

    });

  }
);


/* =========================
   STATIC FRONTEND
========================= */

app.use(
  express.static(
    PUBLIC_DIR
  )
);


/* =========================
   FRONTEND FALLBACK

   Express 5 compatible.
========================= */

app.use(
  (req, res) => {

    res.sendFile(
      path.join(
        PUBLIC_DIR,
        "index.html"
      )
    );

  }
);


/* =========================
   START SERVER
========================= */

ensureDatabase();

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log("");
    console.log(
      "================================"
    );
    console.log(
      "       HarvixPanel ONLINE"
    );
    console.log(
      "================================"
    );

    console.log(
      `Port: ${PORT}`
    );

    console.log(
      `Database: ${DATABASE_FILE}`
    );

    console.log(
      "Panel is ready."
    );

    console.log("");

  }
);

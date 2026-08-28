const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

const PORT = Number(process.env.PORT) || 6969;
const JWT_SECRET =
  process.env.JWT_SECRET || "change-this-secret";

const DATABASE_FILE =
  process.env.DATABASE_FILE ||
  path.join(__dirname, "data", "harvix.json");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, "public");

app.use(express.static(publicDir));

function ensureDatabase() {
  const dir = path.dirname(DATABASE_FILE);

  fs.mkdirSync(dir, {
    recursive: true
  });

  if (!fs.existsSync(DATABASE_FILE)) {
    const database = {
      users: [],
      servers: [],
      nodes: [],
      nextUserId: 1,
      nextServerId: 1,
      nextNodeId: 1
    };

    fs.writeFileSync(
      DATABASE_FILE,
      JSON.stringify(database, null, 2)
    );
  }
}

function readDatabase() {
  ensureDatabase();

  try {
    return JSON.parse(
      fs.readFileSync(
        DATABASE_FILE,
        "utf8"
      )
    );
  } catch (error) {
    return {
      users: [],
      servers: [],
      nodes: [],
      nextUserId: 1,
      nextServerId: 1,
      nextNodeId: 1
    };
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

function authMiddleware(req, res, next) {
  const header =
    req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Not logged in"
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
      message: "Invalid or expired session"
    });
  }
}


/*
REGISTER
*/

app.post(
  "/api/auth/register",
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

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message:
            "Username and password are required."
        });
      }

      if (username.length < 3) {
        return res.status(400).json({
          success: false,
          message:
            "Username must be at least 3 characters."
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 6 characters."
        });
      }

      const database =
        readDatabase();

      const exists =
        database.users.some(
          user =>
            user.username.toLowerCase() ===
            username.toLowerCase()
        );

      if (exists) {
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

        role: "user",

        created_at:
          new Date().toISOString()
      };

      database.users.push(user);

      saveDatabase(database);

      const token =
        createToken(user);

      return res.json({
        success: true,
        message:
          "Account created successfully.",
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
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
          "Registration failed."
      });
    }
  }
);


/*
LOGIN
*/

app.post(
  "/api/auth/login",
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

      if (!username || !password) {
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
            account.username.toLowerCase() ===
            username.toLowerCase()
        );

      if (!user) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid username or password."
        });
      }

      const valid =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (!valid) {
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
          username: user.username,
          role: user.role
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
          "Login failed."
      });
    }
  }
);


/*
CURRENT USER
*/

app.get(
  "/api/auth/me",
  authMiddleware,
  (req, res) => {

    const database =
      readDatabase();

    const user =
      database.users.find(
        account =>
          account.id === req.user.id
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found."
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  }
);


/*
LOGOUT

JWT is stored on the client,
so logout simply removes the token.
*/

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


/*
HEALTH CHECK
*/

app.get(
  "/api/health",
  (req, res) => {

    res.json({
      success: true,
      panel: "HarvixPanel",
      status: "online",
      port: PORT
    });
  }
);


/*
PROTECTED ADMIN TEST
*/

app.get(
  "/api/admin",
  authMiddleware,
  (req, res) => {

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Admin access required."
      });
    }

    res.json({
      success: true,
      message:
        "Welcome to HarvixPanel Admin.",
      user: req.user
    });
  }
);


/*
FRONTEND FALLBACK
*/

app.get(
  "*",
  (req, res) => {

    res.sendFile(
      path.join(
        publicDir,
        "index.html"
      )
    );
  }
);


/*
START
*/

ensureDatabase();

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "╔══════════════════════════════════╗"
    );

    console.log(
      "║        HarvixPanel Online        ║"
    );

    console.log(
      "╚══════════════════════════════════╝"
    );

    console.log(
      `Port: ${PORT}`
    );

    console.log(
      `Database: ${DATABASE_FILE}`
    );
  }
);

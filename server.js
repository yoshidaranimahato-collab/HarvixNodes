"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

/* =========================================================
   CONFIG
========================================================= */

const PORT = Number(process.env.PORT) || 6969;
const HOST = process.env.HOST || "0.0.0.0";

const JWT_SECRET = String(
    process.env.JWT_SECRET ||
    "CHANGE_THIS_HARVIXPANEL_SECRET"
).trim();

/* =========================================================
   PATHS
========================================================= */

const ROOT_DIR = __dirname;

const PUBLIC_DIR = path.join(
    ROOT_DIR,
    "public"
);

const DATA_DIR = path.join(
    ROOT_DIR,
    "data"
);

const DATABASE_FILE = path.join(
    DATA_DIR,
    "harvix.json"
);

const SERVERS_DIR = path.join(
    ROOT_DIR,
    "servers"
);

/* =========================================================
   CREATE DIRECTORIES
========================================================= */

function createDirectories() {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });

    fs.mkdirSync(SERVERS_DIR, {
        recursive: true
    });

    fs.mkdirSync(PUBLIC_DIR, {
        recursive: true
    });
}

createDirectories();

/* =========================================================
   DEFAULT DATABASE
========================================================= */

const DEFAULT_DATABASE = {
    users: [],
    servers: [],
    nodes: [],
    settings: {
        panelName: "HarvixPanel",
        panelImage: "",
        theme: "black"
    }
};

/* =========================================================
   DATABASE READ
========================================================= */

function readDatabase() {
    try {
        if (!fs.existsSync(DATABASE_FILE)) {
            const database = JSON.parse(
                JSON.stringify(DEFAULT_DATABASE)
            );

            saveDatabase(database);

            return database;
        }

        const raw = fs.readFileSync(
            DATABASE_FILE,
            "utf8"
        );

        if (!raw.trim()) {
            return JSON.parse(
                JSON.stringify(DEFAULT_DATABASE)
            );
        }

        const database = JSON.parse(raw);

        if (!Array.isArray(database.users)) {
            database.users = [];
        }

        if (!Array.isArray(database.servers)) {
            database.servers = [];
        }

        if (!Array.isArray(database.nodes)) {
            database.nodes = [];
        }

        if (!database.settings) {
            database.settings = {};
        }

        database.settings.panelName =
            database.settings.panelName ||
            "HarvixPanel";

        database.settings.panelImage =
            database.settings.panelImage || "";

        database.settings.theme =
            database.settings.theme ||
            "black";

        return database;

    } catch (error) {
        console.error(
            "Database read error:",
            error
        );

        return JSON.parse(
            JSON.stringify(DEFAULT_DATABASE)
        );
    }
}

/* =========================================================
   DATABASE SAVE
========================================================= */

function saveDatabase(database) {
    fs.writeFileSync(
        DATABASE_FILE,
        JSON.stringify(
            database,
            null,
            2
        ),
        "utf8"
    );
}

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
);

/* =========================================================
   LOGGER
========================================================= */

app.use((req, res, next) => {
    console.log(
        `${new Date().toISOString()} ${req.method} ${req.url}`
    );

    next();
});

/* =========================================================
   JWT
========================================================= */

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

/* =========================================================
   AUTHENTICATION
========================================================= */

function authenticate(req, res, next) {
    try {
        const header =
            req.headers.authorization;

        if (!header) {
            return res.status(401).json({
                success: false,
                message:
                    "Authentication required."
            });
        }

        const parts =
            header.trim().split(/\s+/);

        if (
            parts.length !== 2 ||
            parts[0].toLowerCase() !== "bearer"
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Invalid authorization format."
            });
        }

        const token = parts[1];

        const decoded = jwt.verify(
            token,
            JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {
        console.error(
            "Authentication error:",
            error.message
        );

        return res.status(401).json({
            success: false,
            message:
                "Invalid or expired token."
        });
    }
}

/* =========================================================
   ADMIN AUTH
========================================================= */

function requireAdmin(req, res, next) {
    if (
        !req.user ||
        req.user.role !== "admin"
    ) {
        return res.status(403).json({
            success: false,
            message:
                "Administrator access required."
        });
    }

    next();
}

/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/api/health",
    (req, res) => {
        res.json({
            success: true,
            panel: "HarvixPanel",
            status: "online",
            time: new Date().toISOString()
        });
    }
);

/* =========================================================
   REGISTER
========================================================= */

app.post(
    "/api/auth/register",
    async (req, res) => {
        try {
            const database =
                readDatabase();

            const firstName = String(
                req.body.firstName || ""
            ).trim();

            const lastName = String(
                req.body.lastName || ""
            ).trim();

            const username = String(
                req.body.username || ""
            ).trim();

            const email = String(
                req.body.email || ""
            )
                .trim()
                .toLowerCase();

            const password = String(
                req.body.password || ""
            );

            if (
                !username ||
                !email ||
                !password
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Username, email and password are required."
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Password must be at least 6 characters."
                });
            }

            const usernameExists =
                database.users.some(
                    user =>
                        String(
                            user.username || ""
                        )
                            .trim()
                            .toLowerCase() ===
                        username.toLowerCase()
                );

            if (usernameExists) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Username is already registered."
                });
            }

            const emailExists =
                database.users.some(
                    user =>
                        String(
                            user.email || ""
                        )
                            .trim()
                            .toLowerCase() ===
                        email
                );

            if (emailExists) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Email is already registered."
                });
            }

            const passwordHash =
                await bcrypt.hash(
                    password,
                    12
                );

            const user = {
                id:
                    "user_" +
                    Date.now() +
                    "_" +
                    Math.random()
                        .toString(36)
                        .slice(2, 10),

                firstName,
                lastName,
                username,
                email,

                passwordHash,

                role: "user",

                servers: [],

                createdAt:
                    new Date().toISOString()
            };

            database.users.push(user);

            saveDatabase(database);

            return res.status(201).json({
                success: true,
                message:
                    "Account created successfully! You can now login."
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

/* =========================================================
   LOGIN
   Original password checking preserved
========================================================= */

app.post(
    "/api/auth/login",
    async (req, res) => {
        try {
            const database =
                readDatabase();

            const identifier = String(
                req.body.identifier ??
                req.body.username ??
                req.body.email ??
                ""
            ).trim();

            const password = String(
                req.body.password ??
                ""
            );

            if (
                !identifier ||
                !password
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Username/email and password are required."
                });
            }

            const identifierLower =
                identifier.toLowerCase();

            const user =
                database.users.find(
                    account => {

                        const username =
                            String(
                                account.username ||
                                ""
                            )
                                .trim()
                                .toLowerCase();

                        const email =
                            String(
                                account.email ||
                                ""
                            )
                                .trim()
                                .toLowerCase();

                        return (
                            username ===
                                identifierLower ||
                            email ===
                                identifierLower
                        );
                    }
                );

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid username/email or password."
                });
            }

            /*
             * ORIGINAL PASSWORD CHECK
             */

            let passwordCorrect = false;

            if (user.passwordHash) {
                passwordCorrect =
                    await bcrypt.compare(
                        password,
                        user.passwordHash
                    );

            } else if (
                typeof user.password === "string"
            ) {
                passwordCorrect =
                    user.password === password;

                if (passwordCorrect) {
                    user.passwordHash =
                        await bcrypt.hash(
                            password,
                            12
                        );

                    delete user.password;

                    saveDatabase(database);
                }
            }

            if (!passwordCorrect) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid username/email or password."
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

                    firstName:
                        user.firstName || "",

                    lastName:
                        user.lastName || "",

                    username:
                        user.username,

                    email:
                        user.email,

                    role:
                        user.role || "user",

                    servers:
                        Array.isArray(
                            user.servers
                        )
                            ? user.servers
                            : []
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

/* =========================================================
   AUTH ME
========================================================= */

app.get(
    "/api/auth/me",
    authenticate,
    (req, res) => {
        try {
            const database =
                readDatabase();

            const user =
                database.users.find(
                    account =>
                        String(account.id) ===
                        String(req.user.id)
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

                    firstName:
                        user.firstName || "",

                    lastName:
                        user.lastName || "",

                    username:
                        user.username,

                    email:
                        user.email,

                    role:
                        user.role || "user",

                    servers:
                        Array.isArray(
                            user.servers
                        )
                            ? user.servers
                            : [],

                    createdAt:
                        user.createdAt
                }
            });

        } catch (error) {
            console.error(
                "Auth me error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to load user."
            });
        }
    }
);

/* =========================================================
   LOGOUT
========================================================= */

app.post(
    "/api/auth/logout",
    authenticate,
    (req, res) => {
        return res.json({
            success: true,
            message:
                "Logged out successfully."
        });
    }
);

/* =========================================================
   CURRENT USER
========================================================= */

app.get(
    "/api/user",
    authenticate,
    (req, res) => {
        try {
            const database =
                readDatabase();

            const user =
                database.users.find(
                    account =>
                        String(account.id) ===
                        String(req.user.id)
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

                    firstName:
                        user.firstName || "",

                    lastName:
                        user.lastName || "",

                    username:
                        user.username,

                    email:
                        user.email,

                    role:
                        user.role || "user",

                    servers:
                        Array.isArray(
                            user.servers
                        )
                            ? user.servers
                            : [],

                    createdAt:
                        user.createdAt
                }
            });

        } catch (error) {
            console.error(
                "Get user error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to load user."
            });
        }
    }
);

/* =========================================================
   ADMIN INFORMATION
========================================================= */

app.get(
    "/api/admin",
    authenticate,
    requireAdmin,
    (req, res) => {
        try {
            const database =
                readDatabase();

            return res.json({
                success: true,

                admin: {
                    id: req.user.id,

                    username:
                        req.user.username,

                    role:
                        req.user.role
                },

                users:
                    database.users.length,

                servers:
                    database.servers.length,

                nodes:
                    database.nodes.length
            });

        } catch (error) {
            console.error(
                "Admin info error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to load admin information."
            });
        }
    }
);

/* =========================================================
   ADMIN - ALL USERS
========================================================= */

app.get(
    "/api/admin/users",
    authenticate,
    requireAdmin,
    (req, res) => {
        try {
            const database =
                readDatabase();

            const users =
                database.users.map(
                    user => ({
                        id: user.id,

                        firstName:
                            user.firstName || "",

                        lastName:
                            user.lastName || "",

                        username:
                            user.username,

                        email:
                            user.email,

                        role:
                            user.role || "user",

                        servers:
                            Array.isArray(
                                user.servers
                            )
                                ? user.servers
                                : [],

                        createdAt:
                            user.createdAt
                    })
                );

            return res.json({
                success: true,
                users
            });

        } catch (error) {
            console.error(
                "Get admin users error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to load users."
            });
        }
    }
);

/* =========================================================
   GET SERVERS
========================================================= */

app.get(
    "/api/servers",
    authenticate,
    (req, res) => {
        try {
            const database =
                readDatabase();

            const allServers =
                Array.isArray(
                    database.servers
                )
                    ? database.servers
                    : [];

            let servers = [];

            /*
             * ADMIN
             */

            if (
                req.user.role === "admin"
            ) {
                servers =
                    allServers;
            }

            /*
             * NORMAL USER
             */

            else {
                const userServers =
                    Array.isArray(
                        req.user.servers
                    )
                        ? req.user.servers
                        : [];

                servers =
                    allServers.filter(
                        server => {

                            /*
                             * Owner
                             */

                            if (
                                String(
                                    server.ownerId
                                ) ===
                                String(
                                    req.user.id
                                )
                            ) {
                                return true;
                            }

                            /*
                             * Assigned server
                             */

                            return userServers.some(
                                serverId =>
                                    String(
                                        serverId
                                    ) ===
                                    String(
                                        server.id
                                    )
                            );
                        }
                    );
            }

            return res.json({
                success: true,
                servers
            });

        } catch (error) {
            console.error(
                "Get servers error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to load servers."
            });
        }
    }
);

/* =========================================================
   STATIC FRONTEND
========================================================= */

app.use(
    express.static(
        PUBLIC_DIR
    )
);

/* =========================================================
   ROOT PAGE
========================================================= */

app.get(
    "/",
    (req, res) => {
        const indexFile =
            path.join(
                PUBLIC_DIR,
                "index.html"
            );

        if (
            !fs.existsSync(indexFile)
        ) {
            return res.status(404).send(
                "HarvixPanel frontend not found. Make sure public/index.html exists."
            );
        }

        return res.sendFile(
            indexFile
        );
    }
);

/* =========================================================
   404 API HANDLER
========================================================= */

app.use(
    "/api",
    (req, res) => {
        return res.status(404).json({
            success: false,
            message:
                "API endpoint not found.",
            path: req.path
        });
    }
);

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
    (error, req, res, next) => {
        console.error(
            "Unhandled server error:",
            error
        );

        if (res.headersSent) {
            return next(error);
        }

        return res.status(500).json({
            success: false,
            message:
                "Internal server error."
        });
    }
);

/* =========================================================
   START HARVIXPANEL
========================================================= */

app.listen(
    PORT,
    HOST,
    () => {
        console.log("");

        console.log(
            "========================================"
        );

        console.log(
            "          HARVIXPANEL"
        );

        console.log(
            "========================================"
        );

        console.log(
            `Server running on http://${HOST}:${PORT}`
        );

        console.log(
            `Port: ${PORT}`
        );

        console.log(
            `Public directory: ${PUBLIC_DIR}`
        );

        console.log(
            `Database: ${DATABASE_FILE}`
        );

        console.log(
            "========================================"
        );
    }
);

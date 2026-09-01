const nodeAuth =
    require("./middleware/node-auth");

const {
    updateNodeHeartbeat,
    getNodeStatus
} = require("./services/heartbeat-service");
"use strict";

/*
========================================================
HARVIXPANEL SERVER
========================================================
Node.js + Express
Authentication
Admin Authentication
Users
Servers
Nodes
Static Frontend
========================================================
*/

const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();


/*
========================================================
APP
========================================================
*/

const app = express();

const PORT =
    Number(process.env.PORT) || 6969;

const HOST =
    process.env.HOST || "0.0.0.0";

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "CHANGE_THIS_HARVIXPANEL_SECRET";


/*
========================================================
PATHS
========================================================
*/

const ROOT_DIR =
    __dirname;

const PUBLIC_DIR =
    path.join(ROOT_DIR, "public");

const DATA_DIR =
    path.join(ROOT_DIR, "data");

const DATABASE_FILE =
    path.join(DATA_DIR, "harvix.json");

const SERVERS_DIR =
    path.join(ROOT_DIR, "servers");


/*
========================================================
CREATE REQUIRED DIRECTORIES
========================================================
*/

function createDirectories() {

    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(
            DATA_DIR,
            { recursive: true }
        );
    }

    if (!fs.existsSync(SERVERS_DIR)) {
        fs.mkdirSync(
            SERVERS_DIR,
            { recursive: true }
        );
    }

    if (!fs.existsSync(PUBLIC_DIR)) {
        fs.mkdirSync(
            PUBLIC_DIR,
            { recursive: true }
        );
    }
}

createDirectories();


/*
========================================================
DEFAULT DATABASE
========================================================
*/

const DEFAULT_DATABASE = {

    users: [],

    servers: [],

    nodes: [

        {
            id: "local-node",
            name: "Local Node",
            host: "127.0.0.1",
            port: 6969,
            status: "online",
            ram: 0,
            disk: 0,
            cpu: 0
        }

    ],

    settings: {

        panelName: "HarvixPanel",

        panelImage: "",

        theme: "black"

    }

};


/*
========================================================
READ DATABASE
========================================================
*/

function readDatabase() {

    try {

        if (!fs.existsSync(DATABASE_FILE)) {

            fs.writeFileSync(
                DATABASE_FILE,
                JSON.stringify(
                    DEFAULT_DATABASE,
                    null,
                    2
                )
            );

            return JSON.parse(
                JSON.stringify(DEFAULT_DATABASE)
            );
        }


        const raw =
            fs.readFileSync(
                DATABASE_FILE,
                "utf8"
            );


        if (!raw.trim()) {

            return JSON.parse(
                JSON.stringify(DEFAULT_DATABASE)
            );

        }


        const database =
            JSON.parse(raw);


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

            database.settings = {
                panelName: "HarvixPanel",
                panelImage: "",
                theme: "black"
            };

        }


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


/*
========================================================
SAVE DATABASE
========================================================
*/

function saveDatabase(database) {

    fs.writeFileSync(
        DATABASE_FILE,
        JSON.stringify(
            database,
            null,
            2
        )
    );

}


/*
========================================================
MIDDLEWARE
========================================================
*/

app.use(
    express.json({
        limit: "5mb"
    })
);

app.use(
    express.urlencoded({
        extended: true
    })
);


/*
========================================================
REQUEST LOGGER
========================================================
*/

app.use(
    (req, res, next) => {

        console.log(
            `${new Date().toISOString()} ${req.method} ${req.url}`
        );

        next();

    }
);


/*
========================================================
JWT CREATE
========================================================
*/

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


/*
========================================================
AUTHENTICATE
========================================================
*/

function authenticate(req, res, next) {

    try {

        const authHeader =
            req.headers.authorization;


        if (!authHeader) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required."

            });

        }


        const parts =
            authHeader.split(" ");


        if (
            parts.length !== 2 ||
            parts[0] !== "Bearer" ||
            !parts[1]
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid authorization format."

            });

        }


        const token =
            parts[1];


        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );


        req.user =
            decoded;


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


/*
========================================================
ADMIN AUTHENTICATE
========================================================
*/

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


/*
========================================================
HEALTH
========================================================
*/

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


/*
========================================================
REGISTER
========================================================
*/

app.post(
    "/api/auth/register",
    async (req, res) => {

        try {

            const database =
                readDatabase();


            const {
                firstName,
                lastName,
                username,
                email,
                password
            } = req.body;


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


            if (
                typeof password !== "string" ||
                password.length < 6
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Password must be at least 6 characters."

                });

            }


            const cleanUsername =
                String(username)
                    .trim();


            const cleanEmail =
                String(email)
                    .trim()
                    .toLowerCase();


            const existingUsername =
                database.users.find(
                    user =>
                        String(user.username)
                            .toLowerCase() ===
                        cleanUsername.toLowerCase()
                );


            if (existingUsername) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Username is already registered."

                });

            }


            const existingEmail =
                database.users.find(
                    user =>
                        String(user.email)
                            .toLowerCase() ===
                        cleanEmail
                );


            if (existingEmail) {

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
                        .slice(2, 8),

                firstName:
                    String(firstName || "")
                        .trim(),

                lastName:
                    String(lastName || "")
                        .trim(),

                username:
                    cleanUsername,

                email:
                    cleanEmail,

                passwordHash,

                role:
                    "user",

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


/*
========================================================
LOGIN
========================================================
*/

app.post(
    "/api/auth/login",
    async (req, res) => {

        try {

            const database =
                readDatabase();


            const identifier =
                String(
                    req.body.identifier ||
                    req.body.username ||
                    req.body.email ||
                    ""
                )
                .trim();


            const password =
                String(
                    req.body.password ||
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
                    account =>

                        String(account.username)
                            .toLowerCase() ===
                        identifierLower

                        ||

                        String(account.email)
                            .toLowerCase() ===
                        identifierLower
                );


            if (!user) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid username/email or password."

                });

            }


            /*
            ----------------------------------------
            PASSWORD CHECK
            ----------------------------------------
            */

            let passwordCorrect = false;


            if (user.passwordHash) {

                passwordCorrect =
                    await bcrypt.compare(
                        password,
                        user.passwordHash
                    );

            }


            /*
            Compatibility with older HarvixPanel
            database entries.
            */

            else if (
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


            /*
            ----------------------------------------
            TOKEN
            ----------------------------------------
            */

            const token =
                createToken(user);


            return res.json({

                success: true,

                message:
                    "Login successful.",

                token,

                user: {

                    id:
                        user.id,

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
                    "Login failed."

            });

        }

    }
);


/*
========================================================
AUTH ME
========================================================
*/

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

                id:
                    user.id,

                username:
                    user.username,

                role:
                    user.role

            }

        });

    }
);


/*
========================================================
LOGOUT
========================================================
*/

app.post(
    "/api/auth/logout",
    authenticate,
    (req, res) => {

        /*
        JWT logout is handled client-side
        by removing the token.
        */

        return res.json({

            success: true,

            message:
                "Logged out successfully."

        });

    }
);


/*
========================================================
GET CURRENT USER
========================================================
*/

app.get(
    "/api/user",
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

                id:
                    user.id,

                firstName:
                    user.firstName || "",

                lastName:
                    user.lastName || "",

                username:
                    user.username,

                email:
                    user.email,

                role:
                    user.role,

                servers:
                    user.servers || [],

                createdAt:
                    user.createdAt

            }

        });

    }
);


/*
========================================================
ADMIN INFORMATION
========================================================
*/

app.get(
    "/api/admin",
    authenticate,
    requireAdmin,
    (req, res) => {

        const database =
            readDatabase();


        return res.json({

            success: true,

            admin: {

                id:
                    req.user.id,

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

    }
);


/*
========================================================
GET ALL USERS - ADMIN
========================================================
*/

app.get(
    "/api/admin/users",
    authenticate,
    requireAdmin,
    (req, res) => {

        const database =
            readDatabase();


        const users =
            database.users.map(
                user => ({

                    id:
                        user.id,

                    username:
                        user.username,

                    email:
                        user.email,

                    role:
                        user.role,

                    servers:
                        user.servers || [],

                    createdAt:
                        user.createdAt

                })
            );


        return res.json({

            success: true,

            users

        });

    }
);


/*
========================================================
GET SERVERS
========================================================
*/

app.get(
    "/api/servers",
    authenticate,
    (req, res) => {

        const database =
            readDatabase();


        let servers;


        if (
            req.user.role === "admin"
        ) {

            servers =
                database.servers;

        } else {

            servers =
                database.servers.filter(
                    server =>
                        server.ownerId ===
                        req.user.id
                        ||
                        (
                            Array.isArray(
                              

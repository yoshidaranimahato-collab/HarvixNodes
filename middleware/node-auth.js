"use strict";

const crypto = require("crypto");

/*
==================================================
HARVIXPANEL NODE AUTHENTICATION
==================================================

Used by:
- Node heartbeat
- Node registration
- Node status
- Other node-agent APIs

Expected:
Authorization: Bearer NODE_TOKEN

The database stores only node_token_hash.
==================================================
*/


function getTokenFromRequest(req) {

    const authorization =
        req.headers.authorization;

    if (!authorization) {
        return null;
    }


    const parts =
        authorization.trim().split(/\s+/);


    if (parts.length !== 2) {
        return null;
    }


    if (
        parts[0].toLowerCase() !==
        "bearer"
    ) {
        return null;
    }


    const token =
        parts[1].trim();


    if (!token) {
        return null;
    }


    return token;
}


/*
==================================================
HASH TOKEN
==================================================
*/

function hashToken(token) {

    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

}


/*
==================================================
SAFE TOKEN COMPARISON
==================================================
*/

function safeCompare(a, b) {

    if (
        typeof a !== "string" ||
        typeof b !== "string"
    ) {
        return false;
    }


    const aBuffer =
        Buffer.from(a, "utf8");

    const bBuffer =
        Buffer.from(b, "utf8");


    if (
        aBuffer.length !==
        bBuffer.length
    ) {
        return false;
    }


    return crypto.timingSafeEqual(
        aBuffer,
        bBuffer
    );

}


/*
==================================================
NODE AUTH MIDDLEWARE
==================================================
*/

function nodeAuth(req, res, next) {

    try {

        const token =
            getTokenFromRequest(req);


        if (!token) {

            return res.status(401).json({

                success: false,

                message:
                    "Node authentication required."

            });

        }


        /*
        Node ID can come from:

        URL:
        /api/nodes/:id/heartbeat

        OR request body:
        { node_id: 1 }
        */

        const nodeId =
            Number(
                req.params.nodeId ||
                req.params.id ||
                req.body?.node_id
            );


        if (
            !Number.isInteger(nodeId) ||
            nodeId <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid node ID."

            });

        }


        /*
        readDatabase must be exposed
        through app.locals.
        */

        if (
            typeof
            req.app.locals.readDatabase !==
            "function"
        ) {

            console.error(
                "readDatabase is not configured."
            );

            return res.status(500).json({

                success: false,

                message:
                    "Database service is not configured."

            });

        }


        const database =
            req.app.locals.readDatabase();


        const nodes =
            Array.isArray(database.nodes)
                ? database.nodes
                : [];


        const node =
            nodes.find(
                item =>
                    Number(item.id) ===
                    nodeId
            );


        if (!node) {

            return res.status(404).json({

                success: false,

                message:
                    "Node not found."

            });

        }


        if (!node.node_token_hash) {

            return res.status(401).json({

                success: false,

                message:
                    "Node is not configured."

            });

        }


        const receivedHash =
            hashToken(token);


        if (
            !safeCompare(
                receivedHash,
                node.node_token_hash
            )
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid node credentials."

            });

        }


        /*
        Attach verified node to request.
        */

        req.node = node;

        req.nodeId = node.id;


        next();


    } catch (error) {

        console.error(
            "Node authentication error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Node authentication failed."

        });

    }

}


/*
==================================================
EXPORT
==================================================
*/

module.exports = nodeAuth;

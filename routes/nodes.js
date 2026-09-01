"use strict";

const express = require("express");
const crypto = require("crypto");

const router = express.Router();

/*
==================================================
HARVIXPANEL NODE ROUTES
==================================================

Expected app locals:

app.locals.readDatabase
app.locals.writeDatabase
app.locals.authenticate
==================================================
*/


function getDatabase(req) {

    if (typeof req.app.locals.readDatabase !== "function") {
        throw new Error("readDatabase is not configured.");
    }

    return req.app.locals.readDatabase();
}


function saveDatabase(req, database) {

    if (typeof req.app.locals.writeDatabase !== "function") {
        throw new Error("writeDatabase is not configured.");
    }

    req.app.locals.writeDatabase(database);
}


/*
==================================================
ADMIN CHECK
==================================================
*/

function adminOnly(req, res, next) {

    if (!req.user) {

        return res.status(401).json({
            success: false,
            message: "Authentication required."
        });

    }

    if (req.user.role !== "admin") {

        return res.status(403).json({
            success: false,
            message: "Admin access required."
        });

    }

    next();
}


/*
==================================================
VALIDATE NODE INPUT
==================================================
*/

function validateNodeInput(body) {

    const name =
        String(body.name || "").trim();

    const ram =
        Number(body.ram_gb);

    const storage =
        Number(body.storage_gb);

    const cpu =
        String(body.cpu || "").trim();

    const location =
        String(body.location || "").trim();

    const allocation =
        String(body.allocation || "").trim();

    const fqdn =
        String(body.fqdn || "").trim();

    let tags = body.tags || [];

    if (!Array.isArray(tags)) {
        tags = [tags];
    }

    tags = tags
        .map(tag => String(tag).trim())
        .filter(Boolean);

    if (!name) {
        return {
            error: "Node name is required."
        };
    }

    if (!Number.isFinite(ram) || ram <= 0) {
        return {
            error: "RAM must be greater than 0."
        };
    }

    if (!Number.isFinite(storage) || storage <= 0) {
        return {
            error: "Storage must be greater than 0."
        };
    }

    const allowedCPU = [
        "Intel Xeon Platinum",
        "AMD EPYC 9GBD",
        "Ryzen 9"
    ];

    if (!allowedCPU.includes(cpu)) {

        return {
            error: "Invalid CPU option."
        };

    }

    if (!location) {
        return {
            error: "Location is required."
        };
    }

    if (!/^\d+\s*-\s*\d+$/.test(allocation)) {

        return {
            error:
                "Allocation must look like 19100-19200."
        };

    }

    const parts =
        allocation
            .split("-")
            .map(Number);

    const allocationStart = parts[0];
    const allocationEnd = parts[1];

    if (
        allocationStart < 1 ||
        allocationEnd > 65535 ||
        allocationStart > allocationEnd
    ) {

        return {
            error: "Invalid allocation range."
        };

    }

    if (!fqdn) {

        return {
            error: "FQDN is required."
        };

    }

    return {

        value: {

            name,
            ram_gb: ram,
            storage_gb: storage,
            cpu,
            location,

            allocation_start:
                allocationStart,

            allocation_end:
                allocationEnd,

            tags,

            fqdn

        }

    };

}


/*
==================================================
GET ALL NODES
ADMIN ONLY
==================================================
*/

router.get(
    "/",
    req => req,
    async (req, res) => {

        try {

            const database =
                getDatabase(req);

            return res.json({

                success: true,

                nodes:
                    database.nodes || []

            });

        } catch (error) {

            console.error(
                "Node list error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to load nodes."

            });

        }

    }
);


/*
==================================================
CREATE NODE
==================================================
*/

router.post(
    "/",
    adminOnly,
    async (req, res) => {

        try {

            const validation =
                validateNodeInput(
                    req.body
                );

            if (validation.error) {

                return res.status(400).json({

                    success: false,

                    message:
                        validation.error

                });

            }

            const database =
                getDatabase(req);

            if (!Array.isArray(database.nodes)) {
                database.nodes = [];
            }

            if (!database.nextNodeId) {
                database.nextNodeId = 1;
            }


            /*
            Prevent duplicate node names
            */

            const duplicate =
                database.nodes.find(
                    node =>
                        node.name.toLowerCase() ===
                        validation.value.name.toLowerCase()
                );

            if (duplicate) {

                return res.status(409).json({

                    success: false,

                    message:
                        "A node with this name already exists."

                });

            }


            /*
            Prevent overlapping allocations
            */

            const newStart =
                validation.value.allocation_start;

            const newEnd =
                validation.value.allocation_end;


            const overlapping =
                database.nodes.find(node => {

                    const oldStart =
                        Number(
                            node.allocation_start
                        );

                    const oldEnd =
                        Number(
                            node.allocation_end
                        );

                    if (
                        !Number.isFinite(oldStart) ||
                        !Number.isFinite(oldEnd)
                    ) {
                        return false;
                    }

                    return (
                        newStart <= oldEnd &&
                        newEnd >= oldStart
                    );

                });


            if (overlapping) {

                return res.status(409).json({

                    success: false,

                    message:
                        "This allocation range overlaps another node."

                });

            }


            /*
            Generate node secret.
            Store ONLY hash.
            */

            const nodeToken =
                crypto.randomBytes(32)
                    .toString("hex");

            const nodeTokenHash =
                crypto
                    .createHash("sha256")
                    .update(nodeToken)
                    .digest("hex");


            const node = {

                id:
                    database.nextNodeId++,

                name:
                    validation.value.name,

                ram_gb:
                    validation.value.ram_gb,

                storage_gb:
                    validation.value.storage_gb,

                cpu:
                    validation.value.cpu,

                location:
                    validation.value.location,

                allocation_start:
                    validation.value.allocation_start,

                allocation_end:
                    validation.value.allocation_end,

                tags:
                    validation.value.tags,

                fqdn:
                    validation.value.fqdn,

                status:
                    "offline",

                maintenance:
                    false,

                last_heartbeat:
                    null,

                node_token_hash:
                    nodeTokenHash,

                created_at:
                    new Date().toISOString()

            };


            database.nodes.push(node);

            saveDatabase(
                req,
                database
            );


            /*
            IMPORTANT:
            Token is returned ONLY once.
            */

            return res.status(201).json({

                success: true,

                message:
                    "Node created successfully.",

                node,

                node_config: {

                    node_id:
                        node.id,

                    panel_url:
                        `${req.protocol}://${req.get("host")}`,

                    node_token:
                        nodeToken

                }

            });


        } catch (error) {

            console.error(
                "Create node error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to create node."

            });

        }

    }
);


/*
==================================================
EDIT NODE
==================================================
*/

router.put(
    "/:id",
    adminOnly,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);

            const database =
                getDatabase(req);

            const node =
                database.nodes.find(
                    item => item.id === id
                );

            if (!node) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Node not found."

                });

            }


            const validation =
                validateNodeInput(
                    req.body
                );

            if (validation.error) {

                return res.status(400).json({

                    success: false,

                    message:
                        validation.error

                });

            }


            node.name =
                validation.value.name;

            node.ram_gb =
                validation.value.ram_gb;

            node.storage_gb =
                validation.value.storage_gb;

            node.cpu =
                validation.value.cpu;

            node.location =
                validation.value.location;

            node.allocation_start =
                validation.value.allocation_start;

            node.allocation_end =
                validation.value.allocation_end;

            node.tags =
                validation.value.tags;

            node.fqdn =
                validation.value.fqdn;


            saveDatabase(
                req,
                database
            );


            return res.json({

                success: true,

                message:
                    "Node updated successfully.",

                node

            });


        } catch (error) {

            console.error(
                "Edit node error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to update node."

            });

        }

    }
);


/*
==================================================
DELETE NODE
==================================================
*/

router.delete(
    "/:id",
    adminOnly,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);

            const database =
                getDatabase(req);

            const index =
                database.nodes.findIndex(
                    node => node.id === id
                );

            if (index === -1) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Node not found."

                });

            }


            const node =
                database.nodes[index];


            /*
            Don't allow deleting a node
            while it still owns servers.
            */

            const hasServers =
                (database.servers || [])
                    .some(
                        server =>
                            Number(
                                server.node_id
                            ) === id
                    );


            if (hasServers) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Cannot delete a node that has servers."

                });

            }


            database.nodes.splice(
                index,
                1
            );


            saveDatabase(
                req,
                database
            );


            return res.json({

                success: true,

                message:
                    "Node deleted successfully."

            });


        } catch (error) {

            console.error(
                "Delete node error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to delete node."

            });

        }

    }
);


/*
==================================================
MAINTENANCE ON
==================================================
*/

router.post(
    "/:id/maintenance/on",
    adminOnly,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);

            const database =
                getDatabase(req);

            const node =
                database.nodes.find(
                    item => item.id === id
                );

            if (!node) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Node not found."

                });

            }


            node.maintenance =
                true;


            saveDatabase(
                req,
                database
            );


            return res.json({

                success: true,

                message:
                    "Node maintenance enabled.",

                node

            });


        } catch (error) {

            console.error(
                "Maintenance ON error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to enable maintenance."

            });

        }

    }
);


/*
==================================================
MAINTENANCE OFF
==================================================
*/

router.post(
    "/:id/maintenance/off",
    adminOnly,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);

            const database =
                getDatabase(req);

            const node =
                database.nodes.find(
                    item => item.id === id
                );

            if (!node) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Node not found."

                });

            }


            node.maintenance =
                false;


            saveDatabase(
                req,
                database
            );


            return res.json({

                success: true,

                message:
                    "Node maintenance disabled.",

                node

            });


        } catch (error) {

            console.error(
                "Maintenance OFF error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to disable maintenance."

            });

        }

    }
);


/*
==================================================
CONFIGURE NODE
==================================================

Generates configuration for the node agent.

The token itself cannot be recovered later,
so Configure generates a new token.
==================================================
*/

router.post(
    "/:id/configure",
    adminOnly,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);

            const database =
                getDatabase(req);

            const node =
                database.nodes.find(
                    item => item.id === id
                );

            if (!node) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Node not found."

                });

            }


            const nodeToken =
                crypto.randomBytes(32)
                    .toString("hex");


            const nodeTokenHash =
                crypto
                    .createHash("sha256")
                    .update(nodeToken)
                    .digest("hex");


            node.node_token_hash =
                nodeTokenHash;

            node.status =
                "offline";

            node.last_heartbeat =
                null;


            saveDatabase(
                req,
                database
            );


            const panelURL =
                process.env.PANEL_URL ||
                `${req.protocol}://${req.get("host")}`;


            const config = {

                node_id:
                    node.id,

                panel_url:
                    panelURL,

                node_token:
                    nodeToken,

                node_name:
                    node.name,

                fqdn:
                    node.fqdn

            };


            return res.json({

                success: true,

                message:
                    "Node configuration generated.",

                config,

                command_config:
                    Buffer
                        .from(
                            JSON.stringify(config)
                        )
                        .toString("base64")

            });


        } catch (error) {

            console.error(
                "Configure node error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to configure node."

            });

        }

    }
);


module.exports = router;

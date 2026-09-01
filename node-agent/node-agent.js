"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const http = require("http");
const { exec } = require("child_process");

/*
========================================================
HARVIXPANEL NODE AGENT
========================================================

Features:
- Panel heartbeat
- Automatic reconnect/retry
- RAM reporting
- CPU usage reporting
- Storage reporting
- Node configuration file
- Graceful shutdown

Config file:
node-agent/node-config.json

Example:

{
    "node_id": 1,
    "panel_url": "https://panel.example.com",
    "node_token": "YOUR_NODE_TOKEN"
}

========================================================
*/


/*
========================================================
CONFIG
========================================================
*/

const CONFIG_PATH =
    process.env.HARVIX_NODE_CONFIG ||
    path.join(
        __dirname,
        "node-config.json"
    );


const HEARTBEAT_INTERVAL =
    15000;


const RETRY_INTERVAL =
    5000;


/*
========================================================
LOAD CONFIG
========================================================
*/

function loadConfig() {

    if (!fs.existsSync(CONFIG_PATH)) {

        console.error("");
        console.error(
            "Node configuration not found."
        );

        console.error(
            `Create: ${CONFIG_PATH}`
        );

        console.error("");

        process.exit(1);

    }


    try {

        const raw =
            fs.readFileSync(
                CONFIG_PATH,
                "utf8"
            );


        const config =
            JSON.parse(raw);


        if (
            !config.node_id ||
            !config.panel_url ||
            !config.node_token
        ) {

            throw new Error(
                "node_id, panel_url and node_token are required."
            );

        }


        return config;


    } catch (error) {

        console.error(
            "Invalid node configuration:"
        );

        console.error(
            error.message
        );

        process.exit(1);

    }

}


const config =
    loadConfig();


/*
========================================================
NORMALIZE PANEL URL
========================================================
*/

const PANEL_URL =
    String(
        config.panel_url
    )
    .replace(
        /\/+$/,
        ""
    );


/*
========================================================
CPU USAGE
========================================================
*/

let previousCPU =
    getCPUInfo();


function getCPUInfo() {

    const cpus =
        os.cpus();


    let idle = 0;
    let total = 0;


    for (
        const cpu of cpus
    ) {

        idle +=
            cpu.times.idle;


        total +=
            cpu.times.user +
            cpu.times.nice +
            cpu.times.sys +
            cpu.times.idle +
            cpu.times.irq;

    }


    return {
        idle,
        total
    };

}


function getCPUUsage() {

    const current =
        getCPUInfo();


    const idle =
        current.idle -
        previousCPU.idle;


    const total =
        current.total -
        previousCPU.total;


    previousCPU =
        current;


    if (total <= 0) {
        return 0;
    }


    const usage =
        100 -
        (
            idle /
            total *
            100
        );


    return Number(
        Math.max(
            0,
            Math.min(
                100,
                usage
            )
        ).toFixed(2)
    );

}


/*
========================================================
RAM
========================================================
*/

function getRAMInfo() {

    const total =
        os.totalmem();


    const free =
        os.freemem();


    const used =
        total - free;


    return {

        total_bytes:
            total,

        used_bytes:
            used,

        free_bytes:
            free,

        total_gb:
            Number(
                (
                    total /
                    1024 /
                    1024 /
                    1024
                ).toFixed(2)
            ),

        used_gb:
            Number(
                (
                    used /
                    1024 /
                    1024 /
                    1024
                ).toFixed(2)
            )

    };

}


/*
========================================================
STORAGE
========================================================
*/

function getStorageInfo() {

    return new Promise(
        resolve => {

            /*
            Linux df command.
            */

            exec(
                "df -kP /",
                {
                    timeout: 5000
                },
                (
                    error,
                    stdout
                ) => {

                    if (error) {

                        resolve({

                            total_gb: 0,
                            used_gb: 0,
                            free_gb: 0

                        });

                        return;

                    }


                    const lines =
                        stdout
                            .trim()
                            .split("\n");


                    if (
                        lines.length < 2
                    ) {

                        resolve({

                            total_gb: 0,
                            used_gb: 0,
                            free_gb: 0

                        });

                        return;

                    }


                    const parts =
                        lines[1]
                            .trim()
                            .split(
                                /\s+/
                            );


                    const totalKB =
                        Number(
                            parts[1]
                        );


                    const usedKB =
                        Number(
                            parts[2]
                        );


                    const freeKB =
                        Number(
                            parts[3]
                        );


                    resolve({

                        total_gb:
                            Number(
                                (
                                    totalKB /
                                    1024 /
                                    1024
                                ).toFixed(2)
                            ),

                        used_gb:
                            Number(
                                (
                                    usedKB /
                                    1024 /
                                    1024
                                ).toFixed(2)
                            ),

                        free_gb:
                            Number(
                                (
                                    freeKB /
                                    1024 /
                                    1024
                                ).toFixed(2)
                            )

                    });

                }
            );

        }
    );

}


/*
========================================================
SEND HTTP REQUEST
========================================================
*/

function sendHeartbeat(payload) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const target =
                new URL(
                    `${PANEL_URL}/api/nodes/heartbeat`
                );


            const body =
                JSON.stringify(
                    payload
                );


            const transport =
                target.protocol ===
                "https:"
                    ? https
                    : http;


            const request =
                transport.request(
                    {

                        hostname:
                            target.hostname,

                        port:
                            target.port ||
                            (
                                target.protocol ===
                                "https:"
                                    ? 443
                                    : 80
                            ),

                        path:
                            target.pathname +
                            target.search,

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Content-Length":
                                Buffer.byteLength(
                                    body
                                ),

                            "Authorization":
                                `Bearer ${config.node_token}`

                        },

                        timeout:
                            10000

                    },
                    response => {

                        let data =
                            "";


                        response.on(
                            "data",
                            chunk => {

                                data +=
                                    chunk.toString();

                            }
                        );


                        response.on(
                            "end",
                            () => {

                                if (
                                    response.statusCode >=
                                    200 &&
                                    response.statusCode <
                                    300
                                ) {

                                    try {

                                        resolve(
                                            JSON.parse(
                                                data
                                            )
                                        );

                                    } catch {

                                        resolve({

                                            success:
                                                true

                                        });

                                    }

                                } else {

                                    reject(
                                        new Error(
                                            `Panel returned HTTP ${response.statusCode}: ${data}`
                                        )
                                    );

                                }

                            }
                        );

                    }
                );


            request.on(
                "timeout",
                () => {

                    request.destroy(
                        new Error(
                            "Panel request timed out."
                        )
                    );

                }
            );


            request.on(
                "error",
                error => {

                    reject(
                        error
                    );

                }
            );


            request.write(
                body
            );


            request.end();

        }
    );

}


/*
========================================================
CREATE HEARTBEAT DATA
========================================================
*/

async function createHeartbeatPayload() {

    const ram =
        getRAMInfo();


    const storage =
        await getStorageInfo();


    const cpuUsage =
        getCPUUsage();


    return {

        node_id:
            Number(
                config.node_id
            ),

        ram_used:
            ram.used_gb,

        ram_total:
            ram.total_gb,

        storage_used:
            storage.used_gb,

        storage_total:
            storage.total_gb,

        cpu_usage:
            cpuUsage,

        agent_version:
            "1.0.0",

        hostname:
            os.hostname(),

        platform:
            os.platform(),

        architecture:
            os.arch(),

        uptime:
            os.uptime(),

        timestamp:
            new Date().toISOString()

    };

}


/*
========================================================
HEARTBEAT
========================================================
*/

let heartbeatRunning =
    false;


async function heartbeat() {

    if (heartbeatRunning) {
        return;
    }


    heartbeatRunning =
        true;


    try {

        const payload =
            await createHeartbeatPayload();


        const response =
            await sendHeartbeat(
                payload
            );


        console.log(
            `[Heartbeat] Node ${config.node_id}: ${response.status || "online"}`
        );


        if (
            response.message
        ) {

            console.log(
                `[Panel] ${response.message}`
            );

        }


    } catch (error) {

        console.error(
            `[Heartbeat] Connection failed: ${error.message}`
        );


        console.log(
            `[Heartbeat] Retrying in ${RETRY_INTERVAL / 1000}s...`
        );

    } finally {

        heartbeatRunning =
            false;

    }

}


/*
========================================================
START AGENT
========================================================
*/

console.log("");
console.log(
    "========================================"
);
console.log(
    "       HARVIXPANEL NODE AGENT"
);
console.log(
    "========================================"
);

console.log(
    `Node ID: ${config.node_id}`
);

console.log(
    `Panel: ${PANEL_URL}`
);

console.log(
    `Heartbeat: ${HEARTBEAT_INTERVAL / 1000}s`
);

console.log(
    "========================================"
);

console.log("");


/*
Initial heartbeat immediately.
*/

heartbeat();


/*
Regular heartbeat.
*/

const heartbeatTimer =
    setInterval(
        heartbeat,
        HEARTBEAT_INTERVAL
    );


/*
========================================================
GRACEFUL SHUTDOWN
========================================================
*/

function shutdown(
    signal
) {

    console.log("");

    console.log(
        `Received ${signal}.`
    );

    console.log(
        "Stopping HarvixPanel Node Agent..."
    );


    clearInterval(
        heartbeatTimer
    );


    process.exit(0);

}


process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);


process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

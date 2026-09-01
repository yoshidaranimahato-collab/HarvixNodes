"use strict";

/*
==================================================
HARVIXPANEL HEARTBEAT SERVICE
==================================================

Responsibilities:
- Update node heartbeat
- Update RAM usage
- Update storage usage
- Update CPU usage
- Mark node ONLINE when heartbeat arrives
- Mark node OFFLINE when heartbeat expires

Heartbeat interval:
~15 seconds

Offline timeout:
45 seconds
==================================================
*/


const HEARTBEAT_TIMEOUT =
    45 * 1000;


/*
==================================================
VALIDATE NUMBER
==================================================
*/

function safeNumber(value, fallback = 0) {

    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return fallback;
    }

    return number;
}


/*
==================================================
UPDATE NODE HEARTBEAT
==================================================
*/

function updateNodeHeartbeat(
    database,
    node,
    data = {}
) {

    if (!node) {

        throw new Error(
            "Node is required."
        );

    }


    const now =
        new Date().toISOString();


    /*
    Basic heartbeat information
    */

    node.last_heartbeat =
        now;

    node.status =
        "online";


    /*
    Resource information

    These values are optional because
    an agent may not send them initially.
    */

    if (
        data.ram_used !== undefined
    ) {

        node.ram_used =
            safeNumber(
                data.ram_used
            );

    }


    if (
        data.ram_total !== undefined
    ) {

        node.ram_total =
            safeNumber(
                data.ram_total
            );

    }


    if (
        data.storage_used !== undefined
    ) {

        node.storage_used =
            safeNumber(
                data.storage_used
            );

    }


    if (
        data.storage_total !== undefined
    ) {

        node.storage_total =
            safeNumber(
                data.storage_total
            );

    }


    if (
        data.cpu_usage !== undefined
    ) {

        node.cpu_usage =
            Math.max(
                0,
                Math.min(
                    100,
                    safeNumber(
                        data.cpu_usage
                    )
                )
            );

    }


    /*
    Agent version can be useful
    for future updates.
    */

    if (data.agent_version) {

        node.agent_version =
            String(
                data.agent_version
            ).slice(
                0,
                100
            );

    }


    /*
    Last successful heartbeat
    */

    node.last_heartbeat_at =
        Date.now();


    return node;
}


/*
==================================================
CHECK NODE ONLINE STATUS
==================================================
*/

function isNodeOnline(node) {

    if (!node) {
        return false;
    }


    if (!node.last_heartbeat_at) {
        return false;
    }


    const elapsed =
        Date.now() -
        Number(
            node.last_heartbeat_at
        );


    return (
        elapsed <=
        HEARTBEAT_TIMEOUT
    );
}


/*
==================================================
REFRESH ALL NODE STATUSES
==================================================
*/

function refreshNodeStatuses(
    database
) {

    if (
        !database ||
        !Array.isArray(
            database.nodes
        )
    ) {

        return;

    }


    const now =
        Date.now();


    for (
        const node
        of database.nodes
    ) {

        /*
        Maintenance has priority.
        */

        if (node.maintenance === true) {

            node.status =
                "maintenance";

            continue;

        }


        /*
        Never mark an unconfigured node
        as online.
        */

        if (
            !node.last_heartbeat_at
        ) {

            node.status =
                "offline";

            continue;

        }


        const elapsed =
            now -
            Number(
                node.last_heartbeat_at
            );


        if (
            elapsed >
            HEARTBEAT_TIMEOUT
        ) {

            node.status =
                "offline";

        } else {

            node.status =
                "online";

        }

    }

}


/*
==================================================
GET NODE STATUS
==================================================
*/

function getNodeStatus(node) {

    if (!node) {

        return {

            status: "offline",

            online: false

        };

    }


    if (
        node.maintenance === true
    ) {

        return {

            status:
                "maintenance",

            online: false

        };

    }


    const online =
        isNodeOnline(
            node
        );


    return {

        status:
            online
                ? "online"
                : "offline",

        online

    };

}


/*
==================================================
EXPORT
==================================================
*/

module.exports = {

    HEARTBEAT_TIMEOUT,

    updateNodeHeartbeat,

    isNodeOnline,

    refreshNodeStatuses,

    getNodeStatus

};

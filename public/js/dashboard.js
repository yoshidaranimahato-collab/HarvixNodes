"use strict";

/*
========================================
HARVIXPANEL DASHBOARD
========================================
*/

const TOKEN_KEY = "harvix_token";
const USER_KEY = "harvix_user";

const token = localStorage.getItem(TOKEN_KEY);

if (!token) {
    window.location.href = "/index.html";
}


/*
========================================
API HELPER
========================================
*/

async function apiRequest(url, options = {}) {

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    const text = await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(
            "Server returned an invalid response."
        );
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            "Request failed."
        );
    }

    return data;
}


/*
========================================
LOAD CURRENT USER
========================================
*/

async function loadUser() {

    try {

        const data =
            await apiRequest(
                "/api/auth/me"
            );

        if (!data.user) {
            throw new Error(
                "User information not found."
            );
        }

        localStorage.setItem(
            USER_KEY,
            JSON.stringify(data.user)
        );

        updateUserUI(data.user);

    } catch (error) {

        console.error(
            "User loading error:",
            error
        );

        /*
        Token invalid/expired
        */

        if (
            error.message.includes(
                "Authentication"
            ) ||
            error.message.includes(
                "expired"
            ) ||
            error.message.includes(
                "Invalid"
            )
        ) {

            localStorage.removeItem(
                TOKEN_KEY
            );

            localStorage.removeItem(
                USER_KEY
            );

            window.location.href =
                "/index.html";

        }

    }
}


/*
========================================
UPDATE USER UI
========================================
*/

function updateUserUI(user) {

    const usernameElements =
        document.querySelectorAll(
            "[data-username], #username, .username"
        );

    usernameElements.forEach(
        element => {
            element.textContent =
                user.username || "User";
        }
    );


    const roleElements =
        document.querySelectorAll(
            "[data-role], #role, .role"
        );

    roleElements.forEach(
        element => {
            element.textContent =
                user.role === "admin"
                    ? "Administrator"
                    : "User";
        }
    );


    /*
    Admin-only navigation
    */

    if (user.role === "admin") {

        document
            .querySelectorAll(
                ".admin-only, [data-admin-only]"
            )
            .forEach(
                element => {
                    element.style.display = "";
                }
            );

    } else {

        document
            .querySelectorAll(
                ".admin-only, [data-admin-only]"
            )
            .forEach(
                element => {
                    element.style.display = "none";
                }
            );

    }
}


/*
========================================
FREE SPECS
========================================
*/

function updateFreeSpecs() {

    const specs = {
        ram: "4150 MB",
        disk: "5180 MB",
        core: "1 vCore"
    };


    /*
    RAM
    */

    document
        .querySelectorAll(
            "[data-spec='ram'], #ramSpec, .ram-spec"
        )
        .forEach(
            element => {
                element.textContent =
                    specs.ram;
            }
        );


    /*
    DISK
    */

    document
        .querySelectorAll(
            "[data-spec='disk'], #diskSpec, .disk-spec"
        )
        .forEach(
            element => {
                element.textContent =
                    specs.disk;
            }
        );


    /*
    CORE
    */

    document
        .querySelectorAll(
            "[data-spec='core'], #coreSpec, .core-spec"
        )
        .forEach(
            element => {
                element.textContent =
                    specs.core;
            }
        );
}


/*
========================================
LOAD SERVERS
========================================
*/

async function loadServers() {

    try {

        const data =
            await apiRequest(
                "/api/servers"
            );

        const servers =
            Array.isArray(data.servers)
                ? data.servers
                : [];

        renderServers(servers);

    } catch (error) {

        console.error(
            "Server loading error:",
            error
        );

        showServerMessage(
            error.message
        );

    }
}


/*
========================================
SERVER CONTAINER
========================================
*/

function getServerContainer() {

    return (
        document.getElementById(
            "serverList"
        ) ||

        document.getElementById(
            "serversList"
        ) ||

        document.getElementById(
            "servers"
        ) ||

        document.querySelector(
            ".server-list"
        ) ||

        document.querySelector(
            ".servers-list"
        )
    );
}


/*
========================================
RENDER SERVERS
========================================
*/

function renderServers(servers) {

    const container =
        getServerContainer();

    if (!container) {
        return;
    }


    /*
    No servers
    */

    if (!servers.length) {

        container.innerHTML = `
            <div class="empty-servers">
                <div class="empty-icon">☁</div>

                <h3>No servers yet</h3>

                <p>
                    You don't have any servers.
                </p>

                <button
                    type="button"
                    onclick="window.location.href='/create-server.html'"
                >
                    Create Server
                </button>
            </div>
        `;

        return;
    }


    /*
    Server cards
    */

    container.innerHTML =
        servers
            .map(
                server =>
                    createServerCard(
                        server
                    )
            )
            .join("");
}


/*
========================================
SERVER CARD
========================================
*/

function createServerCard(server) {

    const id =
        server.id ?? "";

    const name =
        escapeHTML(
            server.name ||
            server.server_name ||
            "Unnamed Server"
        );

    const status =
        String(
            server.status ||
            "offline"
        ).toLowerCase();


    let statusText =
        "Offline";

    if (
        status === "online" ||
        status === "running"
    ) {
        statusText = "Online";
    }


    const statusClass =
        statusText === "Online"
            ? "online"
            : "offline";


    const ram =
        server.ram ||
        server.memory ||
        "—";

    const disk =
        server.storage ||
        server.disk ||
        "—";

    const cpu =
        server.cpu ||
        "1 vCore";


    return `
        <div
            class="server-card"
            data-server-id="${id}"
        >

            <div class="server-card-header">

                <div class="server-icon">
                    ⛏
                </div>

                <div class="server-info">

                    <h3>
                        ${name}
                    </h3>

                    <span
                        class="server-status ${statusClass}"
                    >
                        <i></i>
                        ${statusText}
                    </span>

                </div>

            </div>


            <div class="server-resources">

                <div>
                    <span>RAM</span>
                    <strong>${escapeHTML(String(ram))}</strong>
                </div>

                <div>
                    <span>DISK</span>
                    <strong>${escapeHTML(String(disk))}</strong>
                </div>

                <div>
                    <span>CPU</span>
                    <strong>${escapeHTML(String(cpu))}</strong>
                </div>

            </div>


            <button
                class="server-open-btn"
                type="button"
                onclick="openServer('${id}')"
            >
                Manage Server
            </button>

        </div>
    `;
}


/*
========================================
OPEN SERVER
========================================
*/

function openServer(id) {

    if (!id) {
        return;
    }

    window.location.href =
        `/server.html?id=${encodeURIComponent(id)}`;
}


/*
========================================
SERVER MESSAGE
========================================
*/

function showServerMessage(text) {

    const container =
        getServerContainer();

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="empty-servers">
            <p>
                ${escapeHTML(text)}
            </p>
        </div>
    `;
}


/*
========================================
LOGOUT
========================================
*/

async function logout() {

    try {

        await apiRequest(
            "/api/auth/logout",
            {
                method: "POST"
            }
        );

    } catch (error) {

        console.warn(
            "Logout API error:",
            error
        );

    } finally {

        localStorage.removeItem(
            TOKEN_KEY
        );

        localStorage.removeItem(
            USER_KEY
        );

        window.location.href =
            "/index.html";
    }
}


/*
========================================
LOGOUT BUTTONS
========================================
*/

function setupLogoutButtons() {

    document
        .querySelectorAll(
            "#logout, .logout, [data-logout]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function(event) {

                        event.preventDefault();

                        logout();

                    }
                );

            }
        );
}


/*
========================================
HTML ESCAPE
========================================
*/

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/*
========================================
INITIALIZE
========================================
*/

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        updateFreeSpecs();

        setupLogoutButtons();

        await loadUser();

        await loadServers();

    }
);


/*
========================================
GLOBAL FUNCTIONS
========================================
*/

window.logout =
    logout;

window.openServer =
    openServer;

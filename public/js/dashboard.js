"use strict";

/*
========================================
HARVIXPANEL DASHBOARD
========================================
*/

document.addEventListener("DOMContentLoaded", () => {

    /*
    ========================================
    ELEMENTS
    ========================================
    */

    const serverList =
        document.getElementById("serverList");

    const usernameElement =
        document.getElementById("username");

    const roleElement =
        document.getElementById("role");

    const mobileMenu =
        document.getElementById("mobileMenu");

    const sidebar =
        document.getElementById("sidebar");

    const sidebarOverlay =
        document.getElementById("sidebarOverlay");

    const logoutButton =
        document.getElementById("logout");


    /*
    ========================================
    TOKEN
    ========================================
    */

    function getToken() {

        return localStorage.getItem(
            "harvix_token"
        );

    }


    /*
    ========================================
    AUTH HEADERS
    ========================================
    */

    function getAuthHeaders() {

        const token =
            getToken();

        return {
            "Accept": "application/json",
            "Authorization":
                "Bearer " + token
        };

    }


    /*
    ========================================
    MOBILE SIDEBAR
    ========================================
    */

    if (mobileMenu && sidebar) {

        mobileMenu.addEventListener(
            "click",
            () => {

                sidebar.classList.toggle(
                    "open"
                );

                if (sidebarOverlay) {

                    sidebarOverlay.classList.toggle(
                        "active"
                    );

                }

            }
        );

    }


    if (sidebarOverlay) {

        sidebarOverlay.addEventListener(
            "click",
            () => {

                sidebar.classList.remove(
                    "open"
                );

                sidebarOverlay.classList.remove(
                    "active"
                );

            }
        );

    }


    /*
    ========================================
    SHOW ADMIN MENU
    ========================================
    */

    function showAdminMenu() {

        document
            .querySelectorAll(
                "[data-admin-only]"
            )
            .forEach(element => {

                element.style.display = "";

            });

    }


    /*
    ========================================
    LOAD LOGGED-IN USER
    ========================================
    */

    async function loadUser() {

        const token =
            getToken();


        if (!token) {

            window.location.href =
                "/index.html";

            return null;

        }


        try {

            const response =
                await fetch(
                    "/api/auth/me",
                    {
                        method: "GET",

                        headers:
                            getAuthHeaders()
                    }
                );


            /*
            ========================================
            TOKEN INVALID / EXPIRED
            ========================================
            */

            if (response.status === 401) {

                localStorage.removeItem(
                    "harvix_token"
                );

                localStorage.removeItem(
                    "harvix_user"
                );

                window.location.href =
                    "/index.html";

                return null;

            }


            if (!response.ok) {

                console.error(
                    "Auth API error:",
                    response.status
                );

                return null;

            }


            /*
            ========================================
            RESPONSE
            ========================================
            */

            const data =
                await response.json();


            if (
                !data ||
                !data.success ||
                !data.user
            ) {

                console.error(
                    "Invalid /api/auth/me response:",
                    data
                );

                return null;

            }


            const user =
                data.user;


            /*
            ========================================
            SAVE USER
            ========================================
            */

            localStorage.setItem(
                "harvix_user",
                JSON.stringify(user)
            );


            /*
            ========================================
            USERNAME
            ========================================
            */

            if (usernameElement) {

                usernameElement.textContent =
                    user.username ||
                    "User";

            }


            /*
            ========================================
            ROLE
            ========================================
            */

            if (roleElement) {

                if (
                    user.role === "admin"
                ) {

                    roleElement.textContent =
                        "Administrator";

                } else {

                    roleElement.textContent =
                        "User";

                }

            }


            /*
            ========================================
            ADMIN MENU
            ========================================
            */

            if (
                user.role === "admin"
            ) {

                showAdminMenu();

            }


            return user;


        } catch (error) {

            console.error(
                "User loading error:",
                error
            );

            return null;

        }

    }


    /*
    ========================================
    LOAD SERVERS
    ========================================
    */

    async function loadServers() {

        if (!serverList) {
            return;
        }


        const token =
            getToken();


        if (!token) {

            window.location.href =
                "/index.html";

            return;

        }


        /*
        Loading state
        */

        serverList.innerHTML = `

            <div class="loading-server">

                <div class="loader"></div>

                <span>
                    Loading servers...
                </span>

            </div>

        `;


        try {

            const response =
                await fetch(
                    "/api/servers",
                    {
                        method: "GET",

                        headers:
                            getAuthHeaders()
                    }
                );


            /*
            ========================================
            UNAUTHORIZED
            ========================================
            */

            if (response.status === 401) {

                localStorage.removeItem(
                    "harvix_token"
                );

                localStorage.removeItem(
                    "harvix_user"
                );

                window.location.href =
                    "/index.html";

                return;

            }


            if (!response.ok) {

                throw new Error(
                    "Server API returned " +
                    response.status
                );

            }


            const data =
                await response.json();


            /*
            ========================================
            SERVER DATA
            ========================================
            */

            let servers = [];


            if (Array.isArray(data)) {

                servers =
                    data;

            } else if (
                data &&
                Array.isArray(
                    data.servers
                )
            ) {

                servers =
                    data.servers;

            }


            renderServers(
                servers
            );


        } catch (error) {

            console.error(
                "Server loading error:",
                error
            );


            serverList.innerHTML = `

                <div class="empty-servers">

                    <div class="empty-icon">
                        ⚠
                    </div>

                    <h3>
                        Unable to load servers
                    </h3>

                    <p>
                        Please try again later.
                    </p>

                    <button
                        type="button"
                        id="retryServers">

                        Retry

                    </button>

                </div>

            `;


            const retryButton =
                document.getElementById(
                    "retryServers"
                );


            if (retryButton) {

                retryButton.addEventListener(
                    "click",
                    loadServers
                );

            }

        }

    }


    /*
    ========================================
    RENDER SERVERS
    ========================================
    */

    function renderServers(
        servers
    ) {

        if (!serverList) {
            return;
        }


        /*
        ========================================
        NO SERVER
        ========================================
        */

        if (
            !Array.isArray(servers) ||
            servers.length === 0
        ) {

            serverList.innerHTML = `

                <div class="empty-servers">

                    <div class="empty-icon">
                        ◈
                    </div>

                    <h3>
                        There are no servers associated with your account
                    </h3>

                    <p>
                        No Minecraft server has been assigned to your account yet.
                    </p>

                </div>

            `;

            return;

        }


        /*
        ========================================
        SERVERS EXIST
        ========================================
        */

        serverList.innerHTML = "";


        servers.forEach(
            server => {

                const card =
                    createServerCard(
                        server
                    );

                serverList.appendChild(
                    card
                );

            }
        );

    }


    /*
    ========================================
    CREATE SERVER CARD
    ========================================
    */

    function createServerCard(
        server
    ) {

        const card =
            document.createElement(
                "div"
            );


        card.className =
            "server-card";


        /*
        ========================================
        SERVER NAME
        ========================================
        */

        const serverName =
            server.name ||
            server.serverName ||
            "Minecraft Server";


        const name =
            escapeHTML(
                serverName
            );


        /*
        ========================================
        STATUS
        ========================================
        */

        const rawStatus =
            server.status ||
            "offline";


        const status =
            String(
                rawStatus
            ).toLowerCase();


        const online =
            status === "online" ||
            status === "running" ||
            status === "active";


        /*
        ========================================
        RESOURCES
        ========================================
        */

        const ram =
            server.ram ??
            server.memory ??
            0;


        const disk =
            server.disk ??
            server.storage ??
            0;


        const cpu =
            server.cpu ??
            server.cpus ??
            1;


        /*
        ========================================
        SERVER ID
        ========================================
        */

        const serverId =
            server.id ||
            server.serverId ||
            server.uuid ||
            "";


        card.innerHTML = `

            <div class="server-card-header">

                <div class="server-icon">
                    ◈
                </div>


                <div class="server-info">

                    <h3>
                        ${name}
                    </h3>


                    <div class="
                        server-status
                        ${online
                            ? "online"
                            : "offline"}
                    ">

                        <i></i>

                        ${
                            online
                                ? "Online"
                                : "Offline"
                        }

                    </div>

                </div>

            </div>


            <div class="server-resources">

                <div>

                    <span>
                        RAM
                    </span>

                    <strong>
                        ${formatRAM(ram)}
                    </strong>

                </div>


                <div>

                    <span>
                        DISK
                    </span>

                    <strong>
                        ${formatDisk(disk)}
                    </strong>

                </div>


                <div>

                    <span>
                        CPU
                    </span>

                    <strong>
                        ${formatCPU(cpu)}
                    </strong>

                </div>

            </div>


            <button
                class="server-open-btn"
                type="button">

                Manage Server

            </button>

        `;


        /*
        ========================================
        MANAGE BUTTON
        ========================================
        */

        const manageButton =
            card.querySelector(
                ".server-open-btn"
            );


        if (
            manageButton &&
            serverId
        ) {

            manageButton.addEventListener(
                "click",
                () => {

                    window.location.href =
                        "/server.html?id=" +
                        encodeURIComponent(
                            serverId
                        );

                }
            );

        }


        return card;

    }


    /*
    ========================================
    RAM FORMAT
    ========================================
    */

    function formatRAM(
        value
    ) {

        const number =
            Number(value);


        if (
            !Number.isFinite(
                number
            )
        ) {

            return "0 MB";

        }


        /*
        If value is already GB
        */

        if (
            number > 0 &&
            number < 16
        ) {

            return (
                number +
                " GB"
            );

        }


        if (
            number >= 1024
        ) {

            const gb =
                number / 1024;


            return (
                gb
                    .toFixed(2)
                    .replace(
                        /\.00$/,
                        ""
                    ) +
                " GB"
            );

        }


        return (
            number +
            " MB"
        );

    }


    /*
    ========================================
    DISK FORMAT
    ========================================
    */

    function formatDisk(
        value
    ) {

        const number =
            Number(value);


        if (
            !Number.isFinite(
                number
            )
        ) {

            return "0 GB";

        }


        return (
            number +
            " GB"
        );

    }


    /*
    ========================================
    CPU FORMAT
    ========================================
    */

    function formatCPU(
        value
    ) {

        const number =
            Number(value);


        if (
            !Number.isFinite(
                number
            )
        ) {

            return "1 vCore";

        }


        return (
            number +
            " vCore"
        );

    }


    /*
    ========================================
    ESCAPE HTML
    ========================================
    */

    function escapeHTML(
        value
    ) {

        return String(value)

            .replaceAll(
                "&",
                "&amp;"
            )

            .replaceAll(
                "<",
                "&lt;"
            )

            .replaceAll(
                ">",
                "&gt;"
            )

            .replaceAll(
                '"',
                "&quot;"
            )

            .replaceAll(
                "'",
                "&#039;"
            );

    }


    /*
    ========================================
    LOGOUT
    ========================================
    */

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            async () => {

                try {

                    const token =
                        getToken();


                    await fetch(
                        "/api/auth/logout",
                        {
                            method: "POST",

                            headers: {
                                "Accept":
                                    "application/json",

                                "Authorization":
                                    "Bearer " +
                                    token
                            }
                        }
                    );

                } catch (error) {

                    console.error(
                        "Logout error:",
                        error
                    );

                }


                /*
                Clear local session
                */

                localStorage.removeItem(
                    "harvix_token"
                );

                localStorage.removeItem(
                    "harvix_user"
                );


                window.location.href =
                    "/index.html";

            }
        );

    }


    /*
    ========================================
    INITIALIZE DASHBOARD
    ========================================
    */

    async function init() {

        const user =
            await loadUser();


        if (!user) {
            return;
        }


        await loadServers();

    }


    /*
    START
    */

    init();

});

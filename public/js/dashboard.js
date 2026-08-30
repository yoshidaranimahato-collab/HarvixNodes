document.addEventListener("DOMContentLoaded", () => {

    // ==============================
    // ELEMENTS
    // ==============================

    const serverList = document.getElementById("serverList");
    const usernameElement = document.getElementById("username");
    const roleElement = document.getElementById("role");

    const mobileMenu = document.getElementById("mobileMenu");
    const sidebar = document.getElementById("sidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    const logoutButton = document.getElementById("logout");


    // ==============================
    // MOBILE SIDEBAR
    // ==============================

    if (mobileMenu && sidebar) {
        mobileMenu.addEventListener("click", () => {
            sidebar.classList.toggle("open");

            if (sidebarOverlay) {
                sidebarOverlay.classList.toggle("active");
            }
        });
    }


    if (sidebarOverlay) {
        sidebarOverlay.addEventListener("click", () => {

            sidebar.classList.remove("open");
            sidebarOverlay.classList.remove("active");

        });
    }


    // ==============================
    // GET USER
    // ==============================

    async function loadUser() {

        try {

            const response = await fetch("/api/auth/me", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });


            if (!response.ok) {

                if (response.status === 401) {
                    window.location.href = "/index.html";
                }

                return null;
            }


            const user = await response.json();


            if (usernameElement) {
                usernameElement.textContent =
                    user.username ||
                    user.name ||
                    "User";
            }


            if (roleElement) {

                const role =
                    user.role ||
                    user.type ||
                    "user";

                roleElement.textContent =
                    role === "admin"
                        ? "Administrator"
                        : "User";
            }


            // ==============================
            // ADMIN MENU
            // ==============================

            if (
                user.role === "admin" ||
                user.type === "admin" ||
                user.isAdmin === true
            ) {

                document
                    .querySelectorAll("[data-admin-only]")
                    .forEach(element => {

                        element.style.display = "";

                    });

            }


            return user;

        } catch (error) {

            console.error(
                "User API error:",
                error
            );

            return null;
        }
    }


    // ==============================
    // LOAD SERVERS
    // ==============================

    async function loadServers() {

        if (!serverList) return;


        try {

            const response = await fetch(
                "/api/servers",
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );


            if (!response.ok) {

                if (response.status === 401) {
                    window.location.href =
                        "/index.html";

                    return;
                }


                throw new Error(
                    "Server API returned " +
                    response.status
                );
            }


            const data =
                await response.json();


            let servers = [];


            if (Array.isArray(data)) {

                servers = data;

            } else if (
                Array.isArray(data.servers)
            ) {

                servers = data.servers;

            }


            renderServers(servers);


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


            const retry =
                document.getElementById(
                    "retryServers"
                );


            if (retry) {

                retry.addEventListener(
                    "click",
                    loadServers
                );

            }
        }
    }


    // ==============================
    // RENDER SERVERS
    // ==============================

    function renderServers(servers) {

        if (!serverList) return;


        if (!servers.length) {

            serverList.innerHTML = `
                <div class="empty-servers">

                    <div class="empty-icon">
                        +
                    </div>

                    <h3>
                        No servers yet
                    </h3>

                    <p>
                        Create your first Minecraft
                        server to get started.
                    </p>

                    <button
                        type="button"
                        id="emptyCreateServer">

                        Create Server

                    </button>

                </div>
            `;


            const button =
                document.getElementById(
                    "emptyCreateServer"
                );


            if (button) {

                button.addEventListener(
                    "click",
                    () => {
                        window.location.href =
                            "/create-server.html";
                    }
                );

            }


            return;
        }


        serverList.innerHTML = "";


        servers.forEach(server => {

            const card =
                createServerCard(server);

            serverList.appendChild(card);

        });
    }


    // ==============================
    // SERVER CARD
    // ==============================

    function createServerCard(server) {

        const card =
            document.createElement("div");

        card.className =
            "server-card";


        const name =
            escapeHTML(
                server.name ||
                server.serverName ||
                "Minecraft Server"
            );


        const status =
            String(
                server.status ||
                "offline"
            ).toLowerCase();


        const online =
            status === "online" ||
            status === "running" ||
            status === "active";


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
            0;


        const id =
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

                        ${online
                            ? "Online"
                            : "Offline"}

                    </div>

                </div>

            </div>


            <div class="server-resources">

                <div>

                    <span>RAM</span>

                    <strong>
                        ${formatResource(ram)}
                    </strong>

                </div>


                <div>

                    <span>DISK</span>

                    <strong>
                        ${formatStorage(disk)}
                    </strong>

                </div>


                <div>

                    <span>CPU</span>

                    <strong>
                        ${formatCPU(cpu)}
                    </strong>

                </div>

            </div>


            <button
                class="server-open-btn"
                type="button"
                data-server-id="${escapeHTML(
                    String(id)
                )}">

                Manage Server

            </button>
        `;


        const manageButton =
            card.querySelector(
                ".server-open-btn"
            );


        if (manageButton) {

            manageButton.addEventListener(
                "click",
                () => {

                    if (!id) return;


                    window.location.href =
                        "/server.html?id=" +
                        encodeURIComponent(id);

                }
            );

        }


        return card;
    }


    // ==============================
    // RESOURCE FORMAT
    // ==============================

    function formatResource(value) {

        const number =
            Number(value);


        if (!Number.isFinite(number)) {
            return "0 MB";
        }


        if (number >= 1024) {

            return (
                (number / 1024)
                    .toFixed(2)
                    .replace(/\.00$/, "")
                + " GB"
            );

        }


        return number + " MB";
    }


    function formatStorage(value) {

        const number =
            Number(value);


        if (!Number.isFinite(number)) {
            return "0 GB";
        }


        if (number >= 1024) {

            return (
                (number / 1024)
                    .toFixed(2)
                    .replace(/\.00$/, "")
                + " GB"
            );

        }


        return number + " GB";
    }


    function formatCPU(value) {

        const number =
            Number(value);


        if (!Number.isFinite(number)) {
            return "1 vCore";
        }


        return number + " vCore";
    }


    // ==============================
    // HTML ESCAPE
    // ==============================

    function escapeHTML(value) {

        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    // ==============================
    // LOGOUT
    // ==============================

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            async () => {

                try {

                    await fetch(
                        "/api/auth/logout",
                        {
                            method: "POST",
                            credentials: "include",
                            headers: {
                                "Accept":
                                    "application/json"
                            }
                        }
                    );

                } catch (error) {

                    console.error(
                        "Logout error:",
                        error
                    );

                }


                window.location.href =
                    "/index.html";
            }
        );

    }


    // ==============================
    // START
    // ==============================

    async function init() {

        const user =
            await loadUser();


        if (!user) {
            return;
        }


        await loadServers();

    }


    init();

});

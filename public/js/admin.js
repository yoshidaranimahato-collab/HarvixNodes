document.addEventListener("DOMContentLoaded", () => {

    const username = document.getElementById("adminUsername");
    const logout = document.getElementById("logout");

    const panelName = document.getElementById("panelName");
    const panelImage = document.getElementById("panelImage");
    const saveSettings = document.getElementById("saveSettings");
    const message = document.getElementById("settingsMessage");

    const mobileMenu = document.getElementById("mobileMenu");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");


    // =========================
    // MOBILE SIDEBAR
    // =========================

    if (mobileMenu && sidebar) {
        mobileMenu.addEventListener("click", () => {
            sidebar.classList.toggle("open");

            if (overlay) {
                overlay.classList.toggle("active");
            }
        });
    }

    if (overlay) {
        overlay.addEventListener("click", () => {
            sidebar.classList.remove("open");
            overlay.classList.remove("active");
        });
    }


    // =========================
    // MESSAGE
    // =========================

    function showMessage(text, type = "success") {

        if (!message) return;

        message.textContent = text;

        message.className =
            "message show " + type;

    }


    // =========================
    // ADMIN CHECK
    // =========================

    async function checkAdmin() {

        try {

            const response = await fetch(
                "/api/auth/me",
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );


            if (!response.ok) {

                window.location.href =
                    "/index.html";

                return null;
            }


            const user =
                await response.json();


            const role =
                String(
                    user.role ||
                    user.type ||
                    ""
                ).toLowerCase();


            const isAdmin =
                role === "admin" ||
                user.isAdmin === true;


            if (!isAdmin) {

                alert(
                    "You do not have permission to access the Admin Panel."
                );

                window.location.href =
                    "/dashboard.html";

                return null;
            }


            if (username) {

                username.textContent =
                    user.username ||
                    user.name ||
                    "Admin";

            }


            return user;


        } catch (error) {

            console.error(
                "Admin verification error:",
                error
            );

            window.location.href =
                "/index.html";

            return null;
        }
    }


    // =========================
    // LOAD SETTINGS
    // =========================

    async function loadSettings() {

        try {

            const response = await fetch(
                "/api/settings",
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );


            if (!response.ok) {
                return;
            }


            const settings =
                await response.json();


            if (panelName) {

                panelName.value =
                    settings.panelName ||
                    settings.name ||
                    "HarvixPanel";

            }


            if (panelImage) {

                panelImage.value =
                    settings.panelImage ||
                    settings.image ||
                    "";

            }


        } catch (error) {

            console.error(
                "Settings loading error:",
                error
            );

        }
    }


    // =========================
    // SAVE SETTINGS
    // =========================

    if (saveSettings) {

        saveSettings.addEventListener(
            "click",
            async () => {

                const name =
                    panelName
                        ? panelName.value.trim()
                        : "";

                const image =
                    panelImage
                        ? panelImage.value.trim()
                        : "";


                if (!name) {

                    showMessage(
                        "Panel name is required.",
                        "error"
                    );

                    return;
                }


                saveSettings.disabled = true;

                saveSettings.textContent =
                    "Saving...";


                try {

                    const response =
                        await fetch(
                            "/api/settings",
                            {
                                method: "PUT",

                                credentials:
                                    "include",

                                headers: {
                                    "Content-Type":
                                        "application/json",

                                    "Accept":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({
                                        panelName: name,
                                        panelImage: image
                                    })
                            }
                        );


                    let data = {};

                    try {
                        data =
                            await response.json();
                    } catch (_) {
                        data = {};
                    }


                    if (!response.ok) {

                        throw new Error(
                            data.message ||
                            "Unable to save settings."
                        );

                    }


                    showMessage(
                        "Settings saved successfully.",
                        "success"
                    );


                } catch (error) {

                    console.error(
                        "Save settings error:",
                        error
                    );


                    showMessage(
                        error.message ||
                        "Failed to save settings.",
                        "error"
                    );


                } finally {

                    saveSettings.disabled =
                        false;

                    saveSettings.textContent =
                        "Save Changes";

                }

            }
        );

    }


    // =========================
    // LOGOUT
    // =========================

    if (logout) {

        logout.addEventListener(
            "click",
            async () => {

                try {

                    await fetch(
                        "/api/auth/logout",
                        {
                            method: "POST",
                            credentials: "include"
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


    // =========================
    // INITIALIZE
    // =========================

    async function init() {

        const admin =
            await checkAdmin();


        if (!admin) {
            return;
        }


        await loadSettings();

    }


    init();

});

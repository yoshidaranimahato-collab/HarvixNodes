"use strict";

/* =========================================
   HARVIXPANEL - CREATE SERVER
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("createServerForm");

    if (!form) {
        console.error("createServerForm not found.");
        return;
    }

    const button =
        document.getElementById("createServerButton");

    const message =
        document.getElementById("createServerMessage");

    function showMessage(text, type = "error") {

        if (!message) {
            alert(text);
            return;
        }

        message.textContent = text;
        message.className = "message show " + type;
    }

    function clearMessage() {

        if (!message) return;

        message.textContent = "";
        message.className = "message";
    }

    /*
    ========================================
    GET FORM VALUE
    ========================================
    */

    function value(id) {

        const element =
            document.getElementById(id);

        return element
            ? element.value.trim()
            : "";
    }

    /*
    ========================================
    CREATE SERVER
    ========================================
    */

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        clearMessage();

        const name =
            value("serverName");

        const software =
            value("software");

        const version =
            value("version");

        const ram =
            value("ram");

        const disk =
            value("disk");

        const cpu =
            value("cpu");

        if (!name) {
            showMessage("Enter a server name.");
            return;
        }

        if (!software) {
            showMessage("Select server software.");
            return;
        }

        if (!version) {
            showMessage("Select a server version.");
            return;
        }

        if (button) {

            button.disabled = true;
            button.textContent =
                "Creating server...";
        }

        try {

            /*
            ========================================
            TOKEN
            ========================================
            */

            const token =
                localStorage.getItem("harvix_token");

            /*
            ========================================
            API REQUEST
            ========================================
            */

            const response =
                await fetch("/api/servers", {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        ...(token
                            ? {
                                "Authorization":
                                    "Bearer " + token
                              }
                            : {})
                    },

                    body: JSON.stringify({

                        name: name,

                        software: software,

                        version: version,

                        ram: ram || "4096",

                        disk: disk || "5120",

                        cpu: cpu || "1"

                    })
                });

            /*
            ========================================
            READ RESPONSE SAFELY
            ========================================
            */

            const responseText =
                await response.text();

            let data;

            try {

                data =
                    JSON.parse(responseText);

            } catch (error) {

                console.error(
                    "Create Server API returned:",
                    responseText
                );

                throw new Error(
                    "Server returned HTML instead of JSON. Check server.js API route."
                );
            }

            /*
            ========================================
            API ERROR
            ========================================
            */

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    data.error ||
                    "Server creation failed."
                );
            }

            /*
            ========================================
            SUCCESS
            ========================================
            */

            showMessage(
                data.message ||
                "Server created successfully!",
                "success"
            );

            console.log(
                "Created server:",
                data
            );

            /*
            ========================================
            REDIRECT
            ========================================
            */

            setTimeout(() => {

                if (
                    data.server &&
                    data.server.id
                ) {

                    window.location.href =
                        "/server/index.html?id=" +
                        encodeURIComponent(
                            data.server.id
                        );

                } else {

                    window.location.href =
                        "/dashboard.html";
                }

            }, 800);

        } catch (error) {

            console.error(
                "Create server error:",
                error
            );

            showMessage(
                error.message ||
                "Unable to create server."
            );

        } finally {

            if (button) {

                button.disabled = false;

                button.textContent =
                    "Create Server";
            }
        }

    });

});

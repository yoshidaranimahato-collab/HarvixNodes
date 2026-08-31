/* HarvixPanel Plugin Installer */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const id = new URLSearchParams(location.search).get("id");
    const form = document.getElementById("pluginForm");
    if (!id || !form) return;

    const token = localStorage.getItem("harvix_token");

    form.addEventListener("submit", async e => {
        e.preventDefault();

        const name = document.getElementById("pluginName")?.value.trim();
        if (!name) return alert("Enter a plugin name.");

        try {
            const response = await fetch(`/api/servers/${encodeURIComponent(id)}/plugins/install`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ plugin: name })
            });

            const text = await response.text();
            let data;
            try { data = JSON.parse(text); }
            catch { throw new Error("Plugin API returned HTML instead of JSON."); }

            if (!response.ok) throw new Error(data.message || data.error || "Plugin installation failed.");
            alert(data.message || "Plugin installation started.");
        } catch (error) {
            alert(error.message);
        }
    });
});

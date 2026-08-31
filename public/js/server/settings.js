/* HarvixPanel Server Settings */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const id = new URLSearchParams(location.search).get("id");
    const form = document.getElementById("serverSettingsForm");
    if (!id || !form) return;

    const token = localStorage.getItem("harvix_token");

    form.addEventListener("submit", async e => {
        e.preventDefault();

        const name = document.getElementById("serverNameInput")?.value.trim();
        const ram = document.getElementById("serverRam")?.value.trim();
        const disk = document.getElementById("serverDisk")?.value.trim();
        const cpu = document.getElementById("serverCpu")?.value.trim();

        try {
            const response = await fetch(`/api/servers/${encodeURIComponent(id)}/settings`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ name, ram, disk, cpu })
            });

            const text = await response.text();
            let data;
            try { data = JSON.parse(text); }
            catch { throw new Error("Settings API returned HTML instead of JSON."); }

            if (!response.ok) throw new Error(data.message || data.error || "Settings update failed.");
            alert(data.message || "Settings saved.");
        } catch (error) {
            alert(error.message);
        }
    });
});

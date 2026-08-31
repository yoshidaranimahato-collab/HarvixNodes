/* HarvixPanel Backups */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const id = new URLSearchParams(location.search).get("id");
    const create = document.getElementById("createBackup");
    if (!id || !create) return;

    create.addEventListener("click", async () => {
        const token = localStorage.getItem("harvix_token");

        try {
            const response = await fetch(`/api/servers/${encodeURIComponent(id)}/backups`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });

            const text = await response.text();
            let data;
            try { data = JSON.parse(text); }
            catch { throw new Error("Backup API returned HTML instead of JSON."); }

            if (!response.ok) throw new Error(data.message || data.error || "Backup failed.");
            alert(data.message || "Backup started.");
        } catch (error) {
            alert(error.message);
        }
    });
});

/* HarvixPanel SFTP */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
    const id = new URLSearchParams(location.search).get("id");
    const output = document.getElementById("sftpInfo");
    if (!id || !output) return;

    const token = localStorage.getItem("harvix_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
        const response = await fetch(`/api/servers/${encodeURIComponent(id)}/sftp`, { headers });
        const text = await response.text();
        let data;
        try { data = JSON.parse(text); }
        catch { throw new Error("SFTP API returned HTML instead of JSON."); }

        if (!response.ok) throw new Error(data.message || "Unable to load SFTP details.");

        const info = data.sftp || data;
        output.textContent =
            `Host: ${info.host || "—"}\n` +
            `Port: ${info.port || "—"}\n` +
            `Username: ${info.username || "—"}`;
    } catch (error) {
        output.textContent = error.message;
    }
});

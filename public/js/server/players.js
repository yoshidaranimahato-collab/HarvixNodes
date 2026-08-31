/* HarvixPanel Player Manager */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
    const id = new URLSearchParams(location.search).get("id");
    const list = document.getElementById("playerList");
    if (!id || !list) return;

    const token = localStorage.getItem("harvix_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
        const response = await fetch(`/api/servers/${encodeURIComponent(id)}/players`, { headers });
        const text = await response.text();
        let data;
        try { data = JSON.parse(text); }
        catch { throw new Error("Player API returned HTML instead of JSON."); }

        if (!response.ok) throw new Error(data.message || "Unable to load players.");

        const players = data.players || data;
        list.innerHTML = "";

        if (!Array.isArray(players) || !players.length) {
            list.innerHTML = "<div class='file-row'>No players found.</div>";
            return;
        }

        players.forEach(player => {
            const row = document.createElement("div");
            row.className = "file-row";
            row.textContent = player.name || player.username || String(player);
            list.appendChild(row);
        });
    } catch (error) {
        list.innerHTML = `<div class='file-row'>${error.message}</div>`;
    }
});

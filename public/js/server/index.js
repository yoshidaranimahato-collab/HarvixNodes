/* HarvixPanel Server Overview */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(location.search);
    const serverId = params.get("id");

    if (!serverId) return;

    const token = localStorage.getItem("harvix_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const statusEl = document.getElementById("serverStatus");
    const nameEl = document.getElementById("serverName");
    const startBtn = document.getElementById("startServer");
    const restartBtn = document.getElementById("restartServer");
    const stopBtn = document.getElementById("stopServer");

    async function request(action) {
        const response = await fetch(`/api/servers/${encodeURIComponent(serverId)}/${action}`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" }
        });

        const text = await response.text();
        let data;
        try { data = JSON.parse(text); }
        catch { throw new Error("Server returned HTML instead of JSON. Check server.js."); }

        if (!response.ok) throw new Error(data.message || data.error || "Request failed.");
        return data;
    }

    async function loadServer() {
        const response = await fetch(`/api/servers/${encodeURIComponent(serverId)}`, { headers });
        const text = await response.text();

        let data;
        try { data = JSON.parse(text); }
        catch { throw new Error("Server API returned invalid JSON."); }

        if (!response.ok) throw new Error(data.message || "Unable to load server.");

        const server = data.server || data;

        if (nameEl && server.name) nameEl.textContent = server.name;
        if (statusEl && server.status) {
            statusEl.textContent = server.status;
            statusEl.className = `server-status ${String(server.status).toLowerCase()}`;
        }
    }

    async function run(action) {
        try {
            await request(action);
            await loadServer();
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    }

    startBtn?.addEventListener("click", () => run("start"));
    restartBtn?.addEventListener("click", () => run("restart"));
    stopBtn?.addEventListener("click", () => run("stop"));

    try { await loadServer(); }
    catch (error) { console.error(error); }
});

/* HarvixPanel File Manager */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const id = new URLSearchParams(location.search).get("id");
    const list = document.getElementById("fileList");
    const token = localStorage.getItem("harvix_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    if (!id || !list) return;

    async function loadFiles(path = "") {
        try {
            const url = `/api/servers/${encodeURIComponent(id)}/files?path=${encodeURIComponent(path)}`;
            const response = await fetch(url, { headers });
            const text = await response.text();

            let data;
            try { data = JSON.parse(text); }
            catch { throw new Error("File API returned HTML instead of JSON."); }

            if (!response.ok) throw new Error(data.message || "Unable to load files.");

            const files = data.files || data;
            list.innerHTML = "";

            if (!Array.isArray(files) || !files.length) {
                list.innerHTML = "<div class='file-row'>No files found.</div>";
                return;
            }

            files.forEach(file => {
                const row = document.createElement("div");
                row.className = "file-row";
                row.innerHTML = `<span class="file-name">${file.directory ? "📁" : "📄"} ${escapeHtml(file.name || "")}</span>`;
                list.appendChild(row);
            });
        } catch (error) {
            console.error(error);
            list.innerHTML = `<div class="file-row">${escapeHtml(error.message)}</div>`;
        }
    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value;
        return div.innerHTML;
    }

    loadFiles();
});

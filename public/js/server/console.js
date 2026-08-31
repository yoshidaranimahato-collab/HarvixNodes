/* HarvixPanel Console */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const id = new URLSearchParams(location.search).get("id");
    const output = document.getElementById("consoleOutput");
    const input = document.getElementById("consoleCommand");
    const button = document.getElementById("sendCommand");

    if (!id) return;

    const token = localStorage.getItem("harvix_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    async function send() {
        const command = input?.value.trim();
        if (!command) return;

        try {
            const response = await fetch(`/api/servers/${encodeURIComponent(id)}/console`, {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({ command })
            });

            const text = await response.text();
            let data;
            try { data = JSON.parse(text); }
            catch { throw new Error("Console API returned HTML instead of JSON."); }

            if (!response.ok) throw new Error(data.message || data.error || "Command failed.");

            if (output) {
                output.textContent += `> ${command}\n`;
                if (data.output) output.textContent += `${data.output}\n`;
                output.scrollTop = output.scrollHeight;
            }

            if (input) input.value = "";
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    }

    button?.addEventListener("click", send);
    input?.addEventListener("keydown", e => {
        if (e.key === "Enter") send();
    });
});

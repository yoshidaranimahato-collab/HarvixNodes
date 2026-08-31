/* HarvixPanel Server Splitter */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const id = new URLSearchParams(location.search).get("id");
    const form = document.getElementById("splitterForm");
    if (!id || !form) return;

    const token = localStorage.getItem("harvix_token");

    form.addEventListener("submit", async e => {
        e.preventDefault();

        const name = document.getElementById("splitName")?.value.trim();
        if (!name) return alert("Enter a server name.");

        try {
            const response = await fetch(`/api/servers/${encodeURIComponent(id)}/split`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ name })
            });

            const text = await response.text();
            let data;
            try { data = JSON.parse(text); }
            catch { throw new Error("Splitter API returned HTML instead of JSON."); }

            if (!response.ok) throw new Error(data.message || data.error || "Split failed.");
            alert(data.message || "Server split created.");
        } catch (error) {
            alert(error.message);
        }
    });
});

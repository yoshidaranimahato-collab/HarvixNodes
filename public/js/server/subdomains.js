/* HarvixPanel Subdomain Manager */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const id = new URLSearchParams(location.search).get("id");
    const form = document.getElementById("subdomainForm");
    if (!id || !form) return;

    const token = localStorage.getItem("harvix_token");

    form.addEventListener("submit", async e => {
        e.preventDefault();

        const subdomain = document.getElementById("subdomain")?.value.trim();
        if (!subdomain) return alert("Enter a subdomain.");

        try {
            const response = await fetch(`/api/servers/${encodeURIComponent(id)}/subdomains`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ subdomain })
            });

            const text = await response.text();
            let data;
            try { data = JSON.parse(text); }
            catch { throw new Error("Subdomain API returned HTML instead of JSON."); }

            if (!response.ok) throw new Error(data.message || data.error || "Subdomain creation failed.");
            alert(data.message || "Subdomain saved.");
        } catch (error) {
            alert(error.message);
        }
    });
});

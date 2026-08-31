/* HarvixPanel Votifier Test */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const id = new URLSearchParams(location.search).get("id");
    const button = document.getElementById("testVotifier");
    if (!id || !button) return;

    button.addEventListener("click", async () => {
        const token = localStorage.getItem("harvix_token");

        try {
            const response = await fetch(`/api/servers/${encodeURIComponent(id)}/votifier/test`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });

            const text = await response.text();
            let data;
            try { data = JSON.parse(text); }
            catch { throw new Error("Votifier API returned HTML instead of JSON."); }

            if (!response.ok) throw new Error(data.message || "Votifier test failed.");
            alert(data.message || "Votifier test completed.");
        } catch (error) {
            alert(error.message);
        }
    });
});

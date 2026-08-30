"use strict";

const TOKEN_KEY = "harvix_token";
const USER_KEY = "harvix_user";

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function authHeaders() {
    const token = getToken();

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

async function getCurrentUser() {

    const token = getToken();

    if (!token) {
        window.location.href = "/index.html";
        return null;
    }

    try {

        const response = await fetch("/api/auth/me", {
            method: "GET",
            headers: authHeaders()
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Authentication failed");
        }

        localStorage.setItem(
            USER_KEY,
            JSON.stringify(data.user)
        );

        return data.user;

    } catch (error) {

        console.error("Auth error:", error);

        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);

        window.location.href = "/index.html";

        return null;
    }
}


async function checkAdmin() {

    const user = await getCurrentUser();

    if (!user) return;

    if (user.role !== "admin") {

        window.location.href = "/dashboard.html";

        return;
    }

    showAdminUser(user);
}


function showAdminUser(user) {

    const username =
        document.getElementById("username");

    const role =
        document.getElementById("role");

    if (username) {
        username.textContent =
            user.username;
    }

    if (role) {
        role.textContent =
            "Administrator";
    }

    const avatar =
        document.querySelector(".user-avatar");

    if (avatar) {
        avatar.textContent =
            user.username
                .charAt(0)
                .toUpperCase();
    }
}


async function apiFetch(url, options = {}) {

    const token = getToken();

    if (!token) {
        window.location.href = "/index.html";
        return null;
    }

    options.headers = {
        ...(options.headers || {}),
        "Authorization":
            `Bearer ${token}`,
        "Content-Type":
            "application/json"
    };

    const response =
        await fetch(url, options);

    if (response.status === 401) {

        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);

        window.location.href =
            "/index.html";

        return null;
    }

    return response;
}


function logout() {

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    window.location.href =
        "/index.html";
}


document.addEventListener(
    "DOMContentLoaded",
    () => {

        checkAdmin();

        const logoutButton =
            document.getElementById("logout");

        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                logout
            );
        }

    }
);

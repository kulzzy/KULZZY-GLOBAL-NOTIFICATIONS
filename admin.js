/* =====================================================
   KULZZY RADIO GLOBAL NOTIFICATIONS
   ADMINISTRATION ENGINE
   File: admin.js
   ===================================================== */

import { firebaseConfig, ADMIN_UID } from "./firebase-config.js";

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
    getDatabase,
    ref,
    get,
    push,
    set,
    remove
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";


/* =====================================================
   1. FIREBASE INITIALIZATION
   ===================================================== */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);


/* =====================================================
   2. HTML ELEMENTS
   ===================================================== */

const loginSection = document.getElementById("loginSection");
const dashboard = document.getElementById("dashboard");

const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");

const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");

const adminStatus = document.getElementById("adminStatus");
const loginMessage = document.getElementById("loginMessage");

const notificationTitle = document.getElementById("notificationTitle");
const notificationMessage = document.getElementById("notificationMessage");

const notificationTarget = document.getElementById("notificationTarget");
const notificationStatus = document.getElementById("notificationStatus");

const editingId = document.getElementById("editingId");

const saveButton = document.getElementById("saveButton");
const cancelButton = document.getElementById("cancelButton");
const saveMessage = document.getElementById("saveMessage");

const notificationList = document.getElementById("notificationList");

const totalCount = document.getElementById("totalCount");
const publishedCount = document.getElementById("publishedCount");
const draftCount = document.getElementById("draftCount");

const refreshButton = document.getElementById("refreshButton");
const formHeading = document.getElementById("formHeading");


/* =====================================================
   3. DATABASE PATHS
   ===================================================== */

const PUBLISHED_PATH = "publishedNotifications";
const DRAFT_PATH = "notificationDrafts";


/* =====================================================
   4. HELPER FUNCTIONS
   ===================================================== */

function showMessage(element, message, success = false) {

    element.textContent = message;

    element.style.color = success
        ? "#19c37d"
        : "#ff5252";
}


function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => {

        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[char];
    });
}


function formatDate(timestamp) {

    if (!timestamp) return "Date unavailable";

    return new Date(timestamp).toLocaleString();
}


function setLoading(button, loading, normalText) {

    button.disabled = loading;

    button.textContent = loading
        ? "PLEASE WAIT..."
        : normalText;
}


/* =====================================================
   5. ADMINISTRATOR LOGIN
   ===================================================== */

loginButton.addEventListener("click", async () => {

    const email = adminEmail.value.trim();
    const password = adminPassword.value;

    if (!email || !password) {

        showMessage(
            loginMessage,
            "Enter your administrator email and password."
        );

        return;
    }

    setLoading(loginButton, true, "SIGN IN");

    try {

        const result = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        if (result.user.uid !== ADMIN_UID) {

            await signOut(auth);

            throw new Error(
                "This account is not authorized as the administrator."
            );
        }

        showMessage(
            loginMessage,
            "Login successful.",
            true
        );

    } catch (error) {

        showMessage(
            loginMessage,
            error.message || "Login failed."
        );

    } finally {

        setLoading(loginButton, false, "SIGN IN");
    }
});


/* =====================================================
   6. ADMINISTRATOR LOGOUT
   ===================================================== */

logoutButton.addEventListener("click", async () => {

    try {

        await signOut(auth);

    } catch (error) {

        alert("Logout failed: " + error.message);
    }
});


/* =====================================================
   7. AUTHENTICATION CHECK
   ===================================================== */

onAuthStateChanged(auth, async user => {

    if (!user) {

        loginSection.hidden = false;
        dashboard.hidden = true;

        adminStatus.textContent = "OFFLINE";

        return;
    }

    if (user.uid !== ADMIN_UID) {

        await signOut(auth);

        return;
    }

    loginSection.hidden = true;
    dashboard.hidden = false;

    adminStatus.textContent = "ADMIN ONLINE";

    await loadNotifications();
});


/* =====================================================
   8. LOAD NOTIFICATIONS
   ===================================================== */

async function loadNotifications() {

    if (!auth.currentUser ||
        auth.currentUser.uid !== ADMIN_UID) {
        return;
    }

    notificationList.innerHTML =
        '<p class="empty">Loading notifications...</p>';

    try {

        const publishedSnapshot = await get(
            ref(database, PUBLISHED_PATH)
        );

        const draftSnapshot = await get(
            ref(database, DRAFT_PATH)
        );

        const published = publishedSnapshot.exists()
            ? publishedSnapshot.val()
            : {};

        const drafts = draftSnapshot.exists()
            ? draftSnapshot.val()
            : {};

        const items = [];

        Object.entries(published).forEach(([id, data]) => {

            items.push({
                id,
                source: PUBLISHED_PATH,
                status: "published",
                ...data
            });

        });

        Object.entries(drafts).forEach(([id, data]) => {

            items.push({
                id,
                source: DRAFT_PATH,
                status: "draft",
                ...data
            });

        });

        items.sort((a, b) =>
            (b.createdAt || 0) - (a.createdAt || 0)
        );

        totalCount.textContent = items.length;

        publishedCount.textContent = Object.keys(published).length;

        draftCount.textContent = Object.keys(drafts).length;

        displayNotifications(items);

    } catch (error) {

        notificationList.innerHTML =
            '<p class="empty">Could not load notifications: ' +
            escapeHTML(error.message) +
            '</p>';
    }
}


/* =====================================================
   9. DISPLAY NOTIFICATION HISTORY
   ===================================================== */

function displayNotifications(items) {

    if (!items.length) {

        notificationList.innerHTML =
            '<p class="empty">No notifications have been created yet.</p>';

        return;
    }

    notificationList.innerHTML = items.map(item => {

        const safeTitle = escapeHTML(item.title);
        const safeMessage = escapeHTML(item.message);
        const safeTarget = escapeHTML(item.target);

        const badgeClass = item.status === "published"
            ? "badge-published"
            : "badge-draft";

        const badgeText = item.status.toUpperCase();

        return `

        <div class="notification-item">

            <h3>${safeTitle}</h3>

            <p>${safeMessage.replace(/\n/g, "<br>")}</p>

            <div class="notification-meta">

                <span class="badge ${badgeClass}">
                    ${badgeText}
                </span>

                <span class="badge badge-draft">
                    TARGET: ${safeTarget.toUpperCase()}
                </span>

            </div>

            <p>
                <small>
                    Created: ${escapeHTML(formatDate(item.createdAt))}
                </small>
            </p>

            <div class="notification-actions">

                <button
                    class="edit-button"
                    data-action="edit"
                    data-id="${escapeHTML(item.id)}"
                    data-source="${escapeHTML(item.source)}">
                    EDIT
                </button>

                <button
                    class="delete-button"
                    data-action="delete"
                    data-id="${escapeHTML(item.id)}"
                    data-source="${escapeHTML(item.source)}">
                    DELETE
                </button>

            </div>

        </div>

        `;

    }).join("");
}


/* =====================================================
   10. CREATE OR UPDATE NOTIFICATION
   ===================================================== */

saveButton.addEventListener("click", async () => {

    if (!auth.currentUser ||
        auth.currentUser.uid !== ADMIN_UID) {
        return;
    }

    const title = notificationTitle.value.trim();
    const message = notificationMessage.value.trim();

    const target = notificationTarget.value;
    const status = notificationStatus.value;

    if (!title || !message) {

        showMessage(
            saveMessage,
            "Please enter both the title and message."
        );

        return;
    }

    const

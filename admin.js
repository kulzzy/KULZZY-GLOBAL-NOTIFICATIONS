/* =====================================================
   KULZZY RADIO GLOBAL NOTIFICATIONS
   COMPLETE ADMINISTRATION ENGINE
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


function getFirebaseError(error) {

    const messages = {
        "auth/invalid-email": "The email address is invalid.",
        "auth/user-not-found": "Administrator account was not found.",
        "auth/wrong-password": "Incorrect administrator password.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/too-many-requests": "Too many attempts. Try again later.",
        "auth/network-request-failed": "Network connection failed. Check your internet.",
        "auth/operation-not-allowed": "Email and password login is not enabled in Firebase."
    };

    return messages[error.code] || error.message || "An unexpected error occurred.";
}


/* =====================================================
   5. ADMINISTRATOR LOGIN
   ===================================================== */

loginButton.addEventListener("click", async function() {

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

    showMessage(loginMessage, "Connecting to Firebase...", true);

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
            "Login successful. Opening dashboard...",
            true
        );

    } catch (error) {

        showMessage(
            loginMessage,
            getFirebaseError(error)
        );

    } finally {

        setLoading(loginButton, false, "SIGN IN");
    }

});


/* =====================================================
   6. ADMINISTRATOR LOGOUT
   ===================================================== */

logoutButton.addEventListener("click", async function() {

    try {

        await signOut(auth);

        showMessage(
            loginMessage,
            "You have signed out successfully.",
            true
        );

    } catch (error) {

        alert("Logout failed: " + getFirebaseError(error));
    }

});


/* =====================================================
   7. AUTHENTICATION CHECK
   ===================================================== */

onAuthStateChanged(auth, async function(user) {

    if (!user) {

        loginSection.hidden = false;
        dashboard.hidden = true;

        adminStatus.textContent = "OFFLINE";

        return;
    }

    if (user.uid !== ADMIN_UID) {

        await signOut(auth);

        showMessage(
            loginMessage,
            "Unauthorized administrator account."
        );

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

    if (
        !auth.currentUser ||
        auth.currentUser.uid !== ADMIN_UID
    ) {
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
                id: id,
                source: PUBLISHED_PATH,
                status: "published",
                ...data
            });

        });

        Object.entries(drafts).forEach(([id, data]) => {

            items.push({
                id: id,
                source: DRAFT_PATH,
                status: "draft",
                ...data
            });

        });

        items.sort((a, b) => {

            return (b.createdAt || 0) - (a.createdAt || 0);

        });

        totalCount.textContent = items.length;

        publishedCount.textContent =
            Object.keys(published).length;

        draftCount.textContent =
            Object.keys(drafts).length;

        displayNotifications(items);

    } catch (error) {

        notificationList.innerHTML =
            '<p class="empty">Could not load notifications: ' +
            escapeHTML(getFirebaseError(error)) +
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

        return `

        <div class="notification-item">

            <h3>${safeTitle}</h3>

            <p>${safeMessage.replace(/\n/g, "<br>")}</p>

            <div class="notification-meta">

                <span class="badge ${badgeClass}">
                    ${item.status.toUpperCase()}
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

saveButton.addEventListener("click", async function() {

    if (
        !auth.currentUser ||
        auth.currentUser.uid !== ADMIN_UID
    ) {
        showMessage(saveMessage, "Administrator login required.");
        return;
    }

    const title = notificationTitle.value.trim();
    const message = notificationMessage.value.trim();

    const target = notificationTarget.value;
    const status = notificationStatus.value;

    if (!title || !message) {

        showMessage(
            saveMessage,
            "Please enter both the notification title and message."
        );

        return;
    }

    const oldEditingValue = editingId.value;

    const isEditing = oldEditingValue !== "";

    const parts = oldEditingValue.split(":");

    const oldSource = parts[0];
    const oldId = parts.slice(1).join(":");

    if (
        isEditing &&
        (
            !oldId ||
            ![PUBLISHED_PATH, DRAFT_PATH].includes(oldSource)
        )
    ) {

        showMessage(saveMessage, "Invalid editing record.");

        return;
    }

    const newSource = status === "published"
        ? PUBLISHED_PATH
        : DRAFT_PATH;

    const now = Date.now();

    const record = {

        title: title,
        message: message,
        target: target,
        status: status,

        updatedAt: now,

        updatedBy: auth.currentUser.uid

    };

    setLoading(saveButton, true, "SAVE NOTIFICATION");

    try {

        if (isEditing) {

            const oldRef = ref(
                database,
                oldSource + "/" + oldId
            );

            const oldSnapshot = await get(oldRef);

            if (!oldSnapshot.exists()) {

                throw new Error(
                    "The notification no longer exists."
                );
            }

            const oldData = oldSnapshot.val();

            record.createdAt = oldData.createdAt || now;

            record.createdBy =
                oldData.createdBy || auth.currentUser.uid;

            if (oldSource === newSource) {

                await set(oldRef, record);

            } else {

                const newRef = ref(
                    database,
                    newSource + "/" + oldId
                );

                await set(newRef, record);

                await remove(oldRef);

            }

            showMessage(
                saveMessage,
                "Notification updated successfully!",
                true
            );

        } else {

            record.createdAt = now;

            record.createdBy = auth.currentUser.uid;

            const newRef = push(
                ref(database, newSource)
            );

            await set(newRef, record);

            showMessage(
                saveMessage,
                status === "published"
                    ? "Notification published successfully!"
                    : "Draft saved successfully!",
                true
            );

        }

        resetForm();

        await loadNotifications();

    } catch (error) {

        showMessage(
            saveMessage,
            "Could not save notification: " +
            getFirebaseError(error)
        );

    } finally {

        setLoading(
            saveButton,
            false,
            "SAVE NOTIFICATION"
        );

    }

});


/* =====================================================
   11. EDIT AND DELETE NOTIFICATIONS
   ===================================================== */

notificationList.addEventListener("click", async function(event) {

    const button = event.target.closest("button[data-action]");

    if (!button) return;

    if (
        !auth.currentUser ||
        auth.currentUser.uid !== ADMIN_UID
    ) {
        return;
    }

    const action = button.dataset.action;

    const id = button.dataset.id;

    const source = button.dataset.source;

    if (
        !id ||
        ![PUBLISHED_PATH, DRAFT_PATH].includes(source)
    ) {
        return;
    }

    const recordRef = ref(
        database,
        source + "/" + id
    );

    try {

        const snapshot = await get(recordRef);

        if (!snapshot.exists()) {

            alert("This notification no longer exists.");

            await loadNotifications();

            return;
        }

        const data = snapshot.val();

        if (action === "edit") {

            notificationTitle.value = data.title || "";

            notificationMessage.value = data.message || "";

            notificationTarget.value = data.target || "all";

            notificationStatus.value =
                source === PUBLISHED_PATH
                    ? "published"
                    : "draft";

            editingId.value = source + ":" + id;

            formHeading.textContent = "EDIT NOTIFICATION";

            saveButton.textContent = "UPDATE NOTIFICATION";

            cancelButton.hidden = false;

            showMessage(
                saveMessage,
                "Editing notification.",
                true
            );

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

            return;
        }

        if (action === "delete") {

            const confirmed = confirm(
                "Are you sure you want to permanently delete this notification?"
            );

            if (!confirmed) return;

            await remove(recordRef);

            showMessage(
                saveMessage,
                "Notification deleted successfully.",
                true
            );

            await loadNotifications();

        }

    } catch (error) {

        alert(
            "Operation failed: " + getFirebaseError(error)
        );

    }

});


/* =====================================================
   12. RESET FORM
   ===================================================== */

function resetForm() {

    notificationTitle.value = "";

    notificationMessage.value = "";

    notificationTarget.value = "all";

    notificationStatus.value = "published";

    editingId.value = "";

    formHeading.textContent = "CREATE NOTIFICATION";

    saveButton.textContent = "SAVE NOTIFICATION";

    cancelButton.hidden = true;

}


/* =====================================================
   13. CANCEL EDITING
   ===================================================== */

cancelButton.addEventListener("click", function() {

    resetForm();

    showMessage(
        saveMessage,
        "Editing cancelled.",
        true
    );

});


/* =====================================================
   14. REFRESH NOTIFICATION HISTORY
   ===================================================== */

refreshButton.addEventListener("click", async function() {

    setLoading(refreshButton, true, "REFRESH");

    await loadNotifications();

    setLoading(refreshButton, false, "REFRESH");

});


/* =====================================================
   15. INITIALIZATION
   ===================================================== */

resetForm();

console.log(
    "KULZZY RADIO GLOBAL NOTIFICATION SYSTEM READY"
);

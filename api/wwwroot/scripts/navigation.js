import { isAdmin } from "./constants.js";

// Create the main container div
const navPopupContainer = document.createElement("div");
navPopupContainer.id = "NavigationPopupContainer";
navPopupContainer.className =
  "d-none bg-black vw-100 vh-100 fixed-top d-flex justify-content-center align-items-start text-center";
navPopupContainer.style.setProperty("--bs-bg-opacity", "0.75");

// Create the inner box div
const innerBox = document.createElement("div");
innerBox.className =
  "bg-body mt-5 w-75 h-md-25 rounded-5 d-flex flex-column justify-content-evenly";

// Create the heading
const heading = document.createElement("h1");
heading.className = "mt-4 p-2";
heading.textContent = "What page would you like to go to?";

// Create the buttons container
const buttonsContainer = document.createElement("div");
buttonsContainer.classList = "mb-4 d-flex flex-column flex-md-row justify-content-evenly";

// Create buttons
const buttons = [
  { id: "goHome", text: "Request Songs" },
  { id: "goQueue", text: "Queue" },
  { id: "goAdmin", text: "Song Manager" },
  { id: "goAdminSettings", text: "Settings" },
];

buttons.forEach((btnInfo) => {
  const button = document.createElement("button");
  button.id = btnInfo.id;
  button.className = "btn btn-outline-primary m-2";
  button.textContent = btnInfo.text;
  buttonsContainer.appendChild(button);
});

// Assemble the elements
innerBox.appendChild(heading);
innerBox.appendChild(buttonsContainer);
navPopupContainer.appendChild(innerBox);

// Insert at the very start of the body
document.body.insertBefore(navPopupContainer, document.body.firstChild);

// Navigation Modal Logic
const adminModal = navPopupContainer;

// Close modal if clicking outside the inner box
navPopupContainer.addEventListener("click", (e) => {
  if (e.target === navPopupContainer) {
    closeModal();
  }
});

// Determine base path
const basePath = ""

// Detect current page
const currentPage = window.location.pathname.split("/").pop();
const isAdminPage =
  currentPage === "admin.html" || currentPage === "admin-settings.html";

// Modal buttons
document.getElementById("goHome").onclick = () => {
  window.location.href = basePath + "index.html";
};

document.getElementById("goQueue").onclick = () => {
  window.location.href = basePath + "queue.html";
};

document.getElementById("goAdmin").onclick = () => {
  window.location.href = basePath + "admin.html";
};

document.getElementById("goAdminSettings").onclick = () => {
  window.location.href = basePath + "admin-settings.html";
};

// Open / close modal
function openModal() {
  adminModal.classList.remove("d-none");
  document.body.classList.add("no-scroll");
}

function closeModal() {
  adminModal.classList.add("d-none");
  document.body.classList.remove("no-scroll");
}

// Logo element
const logo = document.getElementById("logo");

// Disable default context menu
logo.addEventListener("contextmenu", (e) => e.preventDefault());

let pressTimer;
const longPressDuration = 600; // ms

// Start long-press or handle modifier keys
function startPress(e) {
  if (isAdmin || isAdminPage) return; // click will handle modal, skip long-press

  if (e.type === "touchstart") e.preventDefault();

  // Desktop shortcut
  if (e.shiftKey || e.ctrlKey) {
    openModal();
    return;
  }

  // Mobile long-press
  pressTimer = setTimeout(openModal, longPressDuration);
}

// Cancel long-press
function cancelPress() {
  clearTimeout(pressTimer);
}

// Attach press events only for index.html behavior
logo.addEventListener("touchstart", startPress);
logo.addEventListener("mousedown", startPress);

logo.addEventListener("touchend", cancelPress);
logo.addEventListener("mouseup", cancelPress);
logo.addEventListener("mouseleave", cancelPress);

// Click behavior
logo.addEventListener("click", (e) => {
  if (isAdmin || isAdminPage) {
    // Admin user or admin page: simple click opens modal
    openModal();
  } else {
    // Non-admin on index: normal click goes home
    if (!e.shiftKey && !e.ctrlKey) {
      window.location.href = basePath + "index.html";
    }
  }
});

// Escape key closes modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
  }
});

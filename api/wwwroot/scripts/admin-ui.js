import { logout, waitForApiAndReload } from "./service.js";
import { currentPlaylist, currentUser, loadSettingsFromApi } from "./constants.js";
import { adminDisplaySongs as displaySongs } from "./displayUpdates.js";

const searchBarElement = document.getElementById("search");
const resultsContainer = document.getElementById("results");
let typingTimer;

searchBarElement.addEventListener("input", async (event) => {
  clearTimeout(typingTimer);

  typingTimer = setTimeout(() => {
    resultsContainer.replaceChildren();
    const query = searchBarElement.value.trim();
    displaySongs(query !== "", query);
  }, 100);
});

try {
  await loadSettingsFromApi();
} catch (e) {
  const loader = document.getElementById("loader");
  if (loader) loader.classList.remove("d-none");
  waitForApiAndReload();
  // stop further initialization until API is available
  throw e;
}

if (!currentUser || currentUser.error) {
  await logout();
}

if (currentUser === null) {
  const loginWarningElement = document.getElementById("loginWarning");
  loginWarningElement.classList.remove("d-none");
} else if (currentPlaylist === null) {
  const playlistWarningElement = document.getElementById("playlistWarning");
  playlistWarningElement.classList.remove("d-none");
}

// displaySongs(true, "travlin");
displaySongs(false);
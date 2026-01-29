import { waitForApiAndReload } from "./service.js";
import { homeDisplaySongs as displaySongs } from "./displayUpdates.js";
import { loadSettingsFromApi } from "./constants.js";

const requestSongsPageButtonElement = document.getElementById("request-songs-page-button");
requestSongsPageButtonElement.addEventListener("click", () => {
  window.location = "./";
});
const queuePageButtonElement = document.getElementById("queue-page-button");
queuePageButtonElement.addEventListener("click", () => {
  window.location = "./queue.html";
});

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
  throw e;
}

displaySongs(false);

import { getRequestedSongs, getUserRequests, searchSongs } from "./service.js";
import {
  addSongToPlaylist,
  requestSong,
  songsAddedToPlaylist,
  userID,
} from "./domain.js";
import {
  currentPlaylist,
  currentUser,
  loadSettingsFromApi,
  numbOfAllowedRequests,
} from "./constants.js";


export const homeDisplaySongs = async (searching, query = "") => {
  displaySongs(searching, query, false);
};

export const adminDisplaySongs = async (searching, query = "") => {
  displaySongs(searching, query, true);
};

const displaySongs = async (
  searching,
  query = "",
  showAddToPlaylistIcon = false
) => {
  const searchBarElement = document.getElementById("search");
  const resultsContainer = document.getElementById("results");

  await loadSettingsFromApi();

  document.getElementById("SectionHeader").textContent = searching
    ? `Search Results for "${query}"`
    : `Requested Songs`;

  // ----- USER REQUEST TRACKING (still works for both, harmless for admin) -----
  const userRequests = userID ? await getUserRequests(userID) : [];
  const userRequestIDs = userRequests?.statusCode
    ? []
    : userRequests.map((r) => r.id);

  const remainingRequestsElement =
    document.getElementById("remaining-requests");

  if (remainingRequestsElement) {
    remainingRequestsElement.textContent =
      !userRequests?.statusCode && userID
        ? numbOfAllowedRequests - userRequests.length
        : numbOfAllowedRequests;
  }

  const results = searching
    ? await searchSongs(query)
    : await getRequestedSongs();

  resultsContainer.replaceChildren();

  if (results.length === 0) {
    const noResultsElement = document.createElement("h4");
    noResultsElement.classList.add("mt-4", "ms-3", "me-3", "mb-3");
    noResultsElement.textContent = searching
      ? "No results found."
      : "No songs have been requested yet. Be the first to request a song!";
    resultsContainer.appendChild(noResultsElement);
    return;
  }

  results.forEach((result) => {
    const resultElement = document.createElement("figure");
    resultElement.classList.add(
      "d-flex",
      "align-items-center",
      "ms-4",
      "p-3",
      "me-4",
      "rounded"
    );

    const alreadyRequested = userRequestIDs.includes(result.id);

    if (alreadyRequested && !showAddToPlaylistIcon) {
      resultElement.classList.add("bg-secondary");
    } else {
      resultElement.classList.add("border", "border-primary");
    }

    // ----- IMAGE -----
    const imgElement = document.createElement("img");
    imgElement.src = result.imgURL;
    imgElement.alt = result.trackName;
    imgElement.style.width = "75px";
    imgElement.style.height = "75px";

    // ----- TEXT -----
    const textContainer = document.createElement("figcaption");
    textContainer.classList.add("ms-3", "flex-grow-1");
    textContainer.style.minWidth = "0";

    const titleElement = document.createElement("h3");
    titleElement.textContent = result.trackName;

    const artistElement = document.createElement("h4");
    artistElement.textContent = result.artistName;

    textContainer.append(titleElement, artistElement);

    if (!searching) {
      const countElement = document.createElement("p");
      countElement.textContent = `Requested ${result.requestCount} ${
        result.requestCount === 1 ? "time" : "times"
      }`;
      textContainer.appendChild(countElement);
    }

    if (currentUser?.email === "mwangsgard25@gmail.com") {
      const idElement = document.createElement("p");
      idElement.textContent = `ID: ${result.id}`;
      textContainer.appendChild(idElement);
    }

    // ----- ADD TO PLAYLIST ICON (ONLY DIFFERENCE) -----
    let addIconElement = null;
    let addOrCheck = null;

    if (showAddToPlaylistIcon && currentPlaylist) {
      addOrCheck = songsAddedToPlaylist.includes(result.id)
        ? "check"
        : "add-icon";

      addIconElement = document.createElement("img");
      addIconElement.id = `add-or-check-${result.id}`;
      addIconElement.src = `images/${addOrCheck}-primary.svg`;
      addIconElement.alt = "Add Song To Playlist";
      addIconElement.style.width = "50px";
    }

    resultElement.append(imgElement, textContainer);
    if (addIconElement) resultElement.appendChild(addIconElement);

    resultsContainer.appendChild(resultElement);

    // ----- HOVER -----
    resultElement.addEventListener("mouseenter", () => {
      resultElement.style.cursor = "pointer";
      resultElement.classList.add("bg-primary", "text-black");
      resultElement.classList.remove("bg-secondary");

      if (addIconElement) {
        addIconElement.src = `images/${addOrCheck}-body.svg`;
      }
    });

    resultElement.addEventListener("mouseleave", () => {
      resultElement.classList.remove("bg-primary", "text-black");

      if (alreadyRequested && !showAddToPlaylistIcon) {
        resultElement.classList.add("bg-secondary");
      }

      if (addIconElement) {
        addIconElement.src = `images/${addOrCheck}-primary.svg`;
      }
    });

    // ----- ADD ICON CLICK -----
    if (addIconElement) {
      addIconElement.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (addOrCheck === "add-icon") {
          await addSongToPlaylist(currentPlaylist, result);
          displaySongs(searching, query, true);
        }
      });
    }

    // ----- ROW CLICK -----
    resultElement.addEventListener("click", async () => {
      searchBarElement.value = "";
      await requestSong(result.id);
      displaySongs(false, "", showAddToPlaylistIcon);
    });
  });
};

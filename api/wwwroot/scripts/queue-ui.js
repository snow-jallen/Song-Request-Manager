import { currentUser, loadSettingsFromApi, masterAdmin } from "./constants.js";
import { GetLineDanceSongs } from "./domain.js";
import {
  getCurrentlyPlayingSong,
  getMasterCurrentlyPlayingSong,
  getQueue,
  getMasterQueue,
  waitForApiAndReload,
} from "./service.js";

const requestSongsPageButtonElement = document.getElementById("request-songs-page-button");
requestSongsPageButtonElement.addEventListener("click", () => {
  window.location = "./";
});
const queuePageButtonElement = document.getElementById("queue-page-button");
queuePageButtonElement.addEventListener("click", () => {
  window.location = "./queue.html";
});

const loader = document.getElementById("loader");
const currentlyPlayingSectionElement = document.getElementById(
  "currentlyPlayingSection",
);
const upNextSectionElement = document.getElementById("queueSection");
const errorMessageElement = document.getElementById("errorMessage");

await loadSettingsFromApi();

const updateQueue = async () => {
  // if (currentUser === null || currentUser.error) {
  // errorMessageElement.classList.remove("d-none");
  // errorMessageElement.textContent = "Please Login to Show Queue";
  // return;
  // }

  if (!masterAdmin || masterAdmin.error) {
    errorMessageElement.classList.remove("d-none");
    errorMessageElement.textContent =
      "No admin account selected. Please contact a member of the Swing Presidency.";
    return;
  }

  const currentlyPlaying = await getMasterCurrentlyPlayingSong();
  const queue = await getMasterQueue();

  if (currentlyPlaying.error) {
    loader.remove();

    setTimeout(updateQueue, 2000);
    errorMessageElement.classList.remove("d-none");
    currentlyPlayingSectionElement.classList.add("d-none");
    upNextSectionElement.classList.add("d-none");
    console.error("No Music Playing");
    return;
  }

  errorMessageElement.classList.add("d-none");
  currentlyPlayingSectionElement.classList.remove("d-none");
  upNextSectionElement.classList.remove("d-none");

  const currentSong = currentlyPlaying.currentSong;
  const currentlyPlayingElement = document.getElementById("currentlyPlaying");
  currentlyPlayingElement.replaceChildren();
  //   console.log(currentlyPlaying.duration);
  const currentlyPlayingSongInfoElement = await createSongElement(
    currentSong,
    true,
    currentlyPlaying.progress,
    currentlyPlaying.duration,
  );

  //   currentlyPlayingSongInfoElement.appendChild(progressBarDivElement);
  currentlyPlayingElement.appendChild(currentlyPlayingSongInfoElement);

  const upNextElement = document.getElementById("queue");
  upNextElement.replaceChildren();

  if (queue.error) {
    loader.remove();
    const errorElement = document.createElement("p");
    errorElement.textContent = "No Songs in Queue";
    errorElement.classList.add("text-center", "fs-4", "mt-3");
    upNextElement.appendChild(errorElement);
    return;
  } else {
    queue.forEach(async (song) => {
      upNextElement.appendChild(await createSongElement(song));
    });
  }
  const timeRemaining = currentlyPlaying.timeRemaining - 300;

  setTimeout(updateQueue, timeRemaining > 0 ? timeRemaining : 5000);
  // setTimeout(updateQueue, 2000);
};

await updateQueue();
loader.remove();

async function createSongElement(
  song,
  currentlyPlaying = false,
  currentTime = 0,
  duration = 0,
) {
  const resultElement = document.createElement("figure");
  resultElement.classList.add("ms-4");
  resultElement.classList.add("p-3");
  resultElement.classList.add("me-4");
  resultElement.classList.add("rounded");
  //   resultElement.classList.add("w-100");

  const lineDanceSongs = await GetLineDanceSongs();
  resultElement.classList.add("border");
  resultElement.classList.add("border-primary");
  if (lineDanceSongs.includes(song.id)) {
    resultElement.classList.add("bg-secondary");
    resultElement.classList.add("border-4");
  } else {
    resultElement.classList.add("bg-body");
  }

  const infoContainerElement = document.createElement("div");
  infoContainerElement.classList.add("d-flex");
  infoContainerElement.classList.add("justify-content-sm-center");
  infoContainerElement.classList.add("align-items-center");

  const imgElement = document.createElement("img");
  imgElement.style.width = currentlyPlaying ? "125px" : "75px";
  imgElement.style.height = currentlyPlaying ? "125px" : "75px";
  imgElement.src = song.imgURL;
  imgElement.alt = song.trackName;

  const textContainer = document.createElement("figcaption");
  textContainer.classList.add("ms-3", "flex-grow-1");
  textContainer.style = "min-width: 0;";

  const titleElement = document.createElement("h3");
  titleElement.classList.add("text-start");
  titleElement.textContent = song.trackName;

  const artistElement = document.createElement("h4");
  artistElement.classList.add("text-start");
  artistElement.textContent = song.artistName;

  const idElement = document.createElement("p");
  idElement.classList.add("text-start");
  idElement.textContent = `ID: ${song.id}`;

  const progressBarDivElement = document.createElement("div");
  progressBarDivElement.classList = "mt-3 d-flex align-items-center ";
  if (currentlyPlaying) {
    const currentTimeElement = document.createElement("span");
    currentTimeElement.classList = "me-3";

    const progressBarElement = document.createElement("progress");
    progressBarElement.classList = "flex-grow-1";
    progressBarElement.style.accentColor = "#51c978";
    progressBarElement.max = 100;

    const endTimeElement = document.createElement("span");
    endTimeElement.classList = "ps-3";
    endTimeElement.textContent = formatTime(duration);

    const tracker = setInterval(() => {
      if (currentTime >= duration + 300) {
        clearInterval(tracker);
        return;
      }

      currentTime += 100;
      currentTimeElement.textContent = formatTime(currentTime);
      progressBarElement.value = (currentTime / duration) * 100;
    }, 100);

    progressBarDivElement.appendChild(currentTimeElement);
    progressBarDivElement.appendChild(progressBarElement);
    progressBarDivElement.appendChild(endTimeElement);
  }

  textContainer.appendChild(titleElement);
  textContainer.appendChild(artistElement);
  if (currentUser !== null && currentUser.email === "mwangsgard25@gmail.com") {
    textContainer.appendChild(idElement);
  }
  infoContainerElement.appendChild(imgElement);
  infoContainerElement.appendChild(textContainer);
  if (currentlyPlaying) {
    textContainer.appendChild(progressBarDivElement);
  }

  resultElement.appendChild(infoContainerElement);

  return resultElement;
}

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
}

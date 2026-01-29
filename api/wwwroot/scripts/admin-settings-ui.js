import {
  allowRepeats,
  autoAdd,
  autoAddTime,
  numbOfAllowedRequests,
  selectedDays,
  setAllowRepeats,
  setAutoAdd,
  setMonday,
  setTuesday,
  setWednesday,
  setThursday,
  setFriday,
  setSaturday,
  setSunday,
  setNumbOfAllowedRequests,
  setUser,
  setAutoAddTime,
  loadSettingsFromApi,
  currentUser,
  currentPlaylist,
  setCurrentPlaylist,
  isAdmin,
  autoAddQuantity,
  setAutoAddQuantity,
  masterAdmin,
  setMasterAdmin,
} from "./constants.js";
import { songsAddedToPlaylist, userID } from "./domain.js";
import {
  getPlaylists,
  login,
  setSettings,
  logout,
  clearRequestsAPI,
  waitForApiAndReload,
  getAdmins,
} from "./service.js";

const bodyElement = document.getElementById("body");
const loginButton = document.getElementById("signIn");
const masterAdminSelectElement = document.getElementById("selectMasterAdmin");
const selectPlaylistButton = document.getElementById("selectPlaylist");
const userNameElement = document.getElementById("userName");
const requestLimitInputElement = document.getElementById("requestLimit");
const allowRepeatsSwitchElement = document.getElementById("allowRepeats");
const autoAddSwitchElement = document.getElementById("autoAdd");
const autoAddQuantityInputElement = document.getElementById("autoAddQuantity");
const mondayCheckboxElement = document.getElementById("dayMonday");
const tuesdayCheckboxElement = document.getElementById("dayTuesday");
const wednesdayCheckboxElement = document.getElementById("dayWednesday");
const thursdayCheckboxElement = document.getElementById("dayThursday");
const fridayCheckboxElement = document.getElementById("dayFriday");
const saturdayCheckboxElement = document.getElementById("daySaturday");
const sundayCheckboxElement = document.getElementById("daySunday");
const timePickerElement = document.getElementById("timePicker");
const cancelChoicePlaylistButton = document.getElementById(
  "CancelPlaylistSelect"
);
const selectChoicePlaylistButton = document.getElementById(
  "SelectPlaylistSelect"
);
const popupElement = document.getElementById("confirmationPopupContainer");
const clearRequestsButton = document.getElementById("clearRequests");
const confirmationCancelButton = document.getElementById("cancelClearRequests");
const confirmationConfirmButton = document.getElementById(
  "confirmClearRequests"
);
let tempSelectedPlaylist = currentPlaylist;

const addAllEventListeners = async () => {

  loginButton.addEventListener("click", async (e) => {
    e.preventDefault();
    
    if (currentUser) {
      await logout();
    } else {
      await login();
    }
    updateUser();
  });

  selectPlaylistButton.addEventListener("click", async (e) => {
    e.preventDefault();
    await displayPlaylists();
    const popupElement = document.getElementById("selectPlaylistContainer");
    popupElement.classList.remove("d-none");
    bodyElement.classList.add("no-scroll");
    // bodyElement.style.scrollBehavior = "hidden";
  });

  requestLimitInputElement.addEventListener("input", () => {
    
    setNumbOfAllowedRequests(requestLimitInputElement.value);
  });

  allowRepeatsSwitchElement.addEventListener("input", () => {
    setAllowRepeats(allowRepeatsSwitchElement.checked);
  });

  autoAddSwitchElement.addEventListener("input", () => {
    setAutoAdd(autoAddSwitchElement.checked);
    const autoAddSelectionElement = document.getElementById("autoAddSelection");
    if (autoAdd) {
      autoAddSelectionElement.classList.remove("visually-hidden");
    } else {
      autoAddSelectionElement.classList.add("visually-hidden");
    }
  });

  autoAddQuantityInputElement.addEventListener("input", () => {
    setAutoAddQuantity(autoAddQuantityInputElement.value);
  });

  mondayCheckboxElement.addEventListener("input", () => {
    setMonday(mondayCheckboxElement.checked);
  });

  tuesdayCheckboxElement.addEventListener("input", () => {
    setTuesday(tuesdayCheckboxElement.checked);
  });

  wednesdayCheckboxElement.addEventListener("input", () => {
    setWednesday(wednesdayCheckboxElement.checked);
  });

  thursdayCheckboxElement.addEventListener("input", () => {
    setThursday(thursdayCheckboxElement.checked);
  });

  fridayCheckboxElement.addEventListener("input", () => {
    setFriday(fridayCheckboxElement.checked);
  });

  saturdayCheckboxElement.addEventListener("input", () => {
    setSaturday(saturdayCheckboxElement.checked);
  });

  sundayCheckboxElement.addEventListener("input", () => {
    setSunday(sundayCheckboxElement.checked);
  });

  timePickerElement.addEventListener("input", () => {
    setAutoAddTime(timePickerElement.value);
  });

  cancelChoicePlaylistButton.addEventListener("click", () => {
    const popupElement = document.getElementById("selectPlaylistContainer");
    popupElement.classList.add("d-none");
    bodyElement.classList.remove("no-scroll");
    updatePlaylist();
  });

  selectChoicePlaylistButton.addEventListener("click", () => {
    const popupElement = document.getElementById("selectPlaylistContainer");
    popupElement.classList.add("d-none");
    bodyElement.classList.remove("no-scroll");
    setCurrentPlaylist(tempSelectedPlaylist);
    updatePlaylist();
  });

  clearRequestsButton.addEventListener("click", async () => {
    popupElement.classList.remove("d-none");
    bodyElement.classList.add("no-scroll");
  });

  confirmationCancelButton.addEventListener("click", () => {
    popupElement.classList.add("d-none");
    bodyElement.classList.remove("no-scroll");
  });

  confirmationConfirmButton.addEventListener("click", async () => {
    await clearRequestsAPI();
    popupElement.classList.add("d-none");
    bodyElement.classList.remove("no-scroll");
  });

  masterAdminSelectElement.addEventListener("input", (e) => {
    const selectedDeviceId = masterAdminSelectElement.value;
    const selectedAdmin = window.adminsArray?.find(a => a.deviceId === selectedDeviceId);
    if (selectedAdmin) {
      setMasterAdmin(selectedAdmin);
    }
  });
};

const updateUser = () => {
  const user = currentUser;
  const allSettingsElement = document.getElementById("allSettings");
  if (user) {
    userNameElement.classList.remove("visually-hidden");
    userNameElement.textContent = `Signed in as ${user.displayName}`;
    const loginButton = document.getElementById("signIn");
    loginButton.textContent = "Sign Out";
    if (isAdmin) {
      allSettingsElement.classList.remove("d-none");
      updateAutoAdd();
    }

    setUser(user);
  } else {
    const loginButton = document.getElementById("signIn");
    loginButton.textContent = "Sign In";
    userNameElement.classList.add("visually-hidden");
    allSettingsElement.classList.add("d-none");
  }
};

const updatePlaylist = () => {
  const selectedPlaylistTextElement = document.getElementById(
    "playlistSelectedText"
  );
  
  if (currentPlaylist) {
    selectedPlaylistTextElement.textContent = `Playlist selected: ${
      currentPlaylist.Name ?? currentPlaylist.name
    }`;
    selectedPlaylistTextElement.classList.remove("visually-hidden");
  } else {
    selectedPlaylistTextElement.classList.add("visually-hidden");
  }
  songsAddedToPlaylist.length = 0;
};

const updateAutoAdd = () => {
  const autoAddSelectionElement = document.getElementById("autoAddSelection");
  if (autoAdd) {
    autoAddSelectionElement.classList.remove("visually-hidden");
  } else {
    autoAddSelectionElement.classList.add("visually-hidden");
  }
};

const loadSettings = async() => {
  await loadSettingsFromApi();
  
  masterAdminSelectElement.value = masterAdmin?.deviceId ?? "";

  requestLimitInputElement.value = numbOfAllowedRequests;

  allowRepeatsSwitchElement.checked = allowRepeats;

  autoAddSwitchElement.checked = autoAdd;

  autoAddQuantityInputElement.value = autoAddQuantity;

  mondayCheckboxElement.checked = selectedDays.monday;
  tuesdayCheckboxElement.checked = selectedDays.tuesday;
  wednesdayCheckboxElement.checked = selectedDays.wednesday;
  thursdayCheckboxElement.checked = selectedDays.thursday;
  fridayCheckboxElement.checked = selectedDays.friday;
  saturdayCheckboxElement.checked = selectedDays.saturday;
  sundayCheckboxElement.checked = selectedDays.sunday;

  timePickerElement.value = "22:15";
  updateUser();
  updatePlaylist();
  updateAutoAdd();
};

const displayPlaylists = async () => {
  if (currentUser !== null) {
    const playlists = await getPlaylists();

    const playlistListElement = document.getElementById("playlistList");
    playlistListElement.replaceChildren();

    // <div id="playlistExampleElement" class="rounded-5 p-3 m-3 d-flex justify-content-center align-items-center">
    //           <img src="https://i.scdn.co/image/ab67616d00004851f00a1acf866539632b187ea0" alt="Country Music">
    //           <h4 class="ms-4">Country Music</h4>
    //         </div>

    playlists.forEach((p) => {
    
      const playlistElement = document.createElement("div");
      if (tempSelectedPlaylist !== null && p.Id === tempSelectedPlaylist.Id) {
        playlistElement.classList.add("bg-secondary");
      }
      
      playlistElement.classList.add("rounded-5");
      playlistElement.classList.add("p-3");
      playlistElement.classList.add("m-3");
      playlistElement.classList.add("d-flex");
      playlistElement.classList.add("justify-content-center");
      playlistElement.classList.add("align-items-center");
      playlistListElement.appendChild(playlistElement);

      const playlistImageElement = document.createElement("img");
      playlistImageElement.style = "height: 75px;";
      playlistImageElement.src = p.ImgUrl ?? "./images/missing-image.svg";
      playlistImageElement.alt = p.Name;
      playlistElement.appendChild(playlistImageElement);

      const playlistTextElement = document.createElement("h4");
      playlistTextElement.classList.add("ms-4");
      playlistTextElement.textContent = p.Name;
      playlistElement.appendChild(playlistTextElement);

      playlistElement.addEventListener("mouseenter", () => {
        playlistElement.style.cursor = "pointer";
        playlistElement.classList.remove("bg-body");
        playlistElement.classList.remove("bg-secondary");
        playlistElement.classList.add("bg-primary");
        playlistElement.classList.add("text-black");
      });
      playlistElement.addEventListener("mouseleave", () => {
        if (tempSelectedPlaylist !== null && p.Id === tempSelectedPlaylist.Id) {
          playlistElement.classList.add("bg-secondary");
        } else {
          playlistElement.classList.add("bg-body");
        }
        playlistElement.classList.remove("bg-primary");
        playlistElement.classList.remove("text-black");
      });

      playlistElement.addEventListener("click", () => {
        if (tempSelectedPlaylist !== null && p.Id === tempSelectedPlaylist.Id) {
          tempSelectedPlaylist = null;
          displayPlaylists();
          return;
        }

        tempSelectedPlaylist = p;
        displayPlaylists();
      });
    });
  }
};

addAllEventListeners();

try {
  await loadSettingsFromApi();
} catch (e) {
  const loaderElement = document.getElementById("loader");
  if (loaderElement) loaderElement.classList.remove("d-none");
  waitForApiAndReload();
  // stop further initialization until API is available
  throw e;
}

// console.log("Current User:", currentUser);
if (!currentUser || currentUser.error) {
  await logout();
}

const admins = await getAdmins();
window.adminsArray = admins;

admins.forEach((admin) => {
  const optionElement = document.createElement("option");
  optionElement.value = admin.deviceId;
  optionElement.textContent = admin.displayName;
  masterAdminSelectElement.appendChild(optionElement);
});

await loadSettings();

if (admins.length === 1 )
  {
    masterAdminSelectElement.value = admins[0].deviceId;
    setMasterAdmin(admins[0]);
  }
const loaderElement = document.getElementById("loader");
if (loaderElement) loaderElement.classList.add("d-none");
const loginSectionElement = document.getElementById("loginSection");
if (loginSectionElement) loginSectionElement.classList.remove("d-none");

await setSettings();
 
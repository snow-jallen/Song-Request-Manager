import { homeDisplaySongs, adminDisplaySongs } from "./displayUpdates.js";
import { myApiUrl } from "./constants.js";

const signalR = globalThis.signalR;
if (!signalR) {
  console.error(
    "SignalR client not found on global scope. Make sure 'scripts/signalr/signalr.js' is included before module scripts."
  );
} else {
  console.log("SignalR client loaded.");

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${myApiUrl}/songRequestManager`, { withCredentials: false })
    .withAutomaticReconnect()
    .build();

  // Debounce helper (trailing) to avoid rapid repeated UI refreshes
  const debounce = (fn, wait = 300) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => {
        Promise.resolve(fn(...args)).catch((err) => console.error(err));
      }, wait);
    };
  };

  const handleReceiveUpdate = async () => {
    const searchBarElement = document.getElementById("search");
    if (searchBarElement && searchBarElement.value === "") {
      if (window.location.pathname === "/" || window.location.pathname === "/docs/") {
        await homeDisplaySongs(false);
      } else if (window.location.pathname === "/admin" || window.location.pathname === "/docs/admin.html") {
        await adminDisplaySongs(false);
      }
    }
  };

  connection.on("ReceiveSongRequestUpdate", debounce(handleReceiveUpdate, 300));

  connection
    .start()
    .then(() => console.log("SignalR Connected"))
    .catch((err) => console.error("SignalR start failed:", err));
}

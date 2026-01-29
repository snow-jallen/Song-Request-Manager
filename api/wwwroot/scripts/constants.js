import { getSettings, setSettings, scheduleSetSettings } from "./service.js";

// export const myApiUrl = "http://127.0.0.1:5001";
export const myApiUrl = "";

// settings
export let currentUser = null;
export let masterAdmin = null;
export let currentPlaylist = null;
export let numbOfAllowedRequests = 3;
export let allowRepeats = true;
export let autoAdd = false;
export let autoAddQuantity = 3;
export const selectedDays = {
  monday: false,
  tuesday: false,
  wednesday: true,
  thursday: false,
  friday: false,
  saturday: false,
  sunday: false,
};
export let autoAddTime = "22:15";
export let isAdmin = false;

export const loadSettingsFromApi = async () => {
  const result = await getSettings();
  const settings = result.settings ?? result;
  const me = result.me ?? null;

  // update local settings
  currentPlaylist = settings.currentPlaylist;
  masterAdmin = settings.masterAdmin;
  numbOfAllowedRequests = settings.numbOfAllowedRequests;
  allowRepeats = settings.allowRepeats;
  autoAdd = settings.autoAdd;
  autoAddQuantity = settings.autoAddQuantity;
  selectedDays.monday = settings.selectedDays.monday;
  selectedDays.tuesday = settings.selectedDays.tuesday;
  selectedDays.wednesday = settings.selectedDays.wednesday;
  selectedDays.thursday = settings.selectedDays.thursday;
  selectedDays.friday = settings.selectedDays.friday;
  selectedDays.saturday = settings.selectedDays.saturday;
  selectedDays.sunday = settings.selectedDays.sunday;
  autoAddTime = settings.autoAddTime;
  isAdmin = settings.isAdmin;

  // set current user locally without triggering a settings save
  setUserLocal(me);
};


export const setUser = (user) => {
  currentUser = user;
  scheduleSetSettings();
};
export const setMasterAdmin = (admin) => {
  masterAdmin = admin;
  scheduleSetSettings();
}
export const setUserLocal = (user) => {
  currentUser = user;
};
export const setCurrentPlaylist = (playlist) => {
  currentPlaylist = playlist;
  scheduleSetSettings();
};
export const setNumbOfAllowedRequests = (limit) => {
  numbOfAllowedRequests = limit;
  scheduleSetSettings();
};
export const setAllowRepeats = (allowed) => {
  allowRepeats = allowed;
  scheduleSetSettings();
};
export const setAutoAdd = (auto) => {
  autoAdd = auto;
  scheduleSetSettings();
};
export const setAutoAddQuantity = (quantity) => {
  autoAddQuantity = quantity;
  scheduleSetSettings();
}
export const setMonday = (monday) => {
  selectedDays.monday = monday;
  scheduleSetSettings();
};
export const setTuesday = (tuesday) => {
  selectedDays.tuesday = tuesday;
  scheduleSetSettings();
};
export const setWednesday = (wednesday) => {
  selectedDays.wednesday = wednesday;
  scheduleSetSettings();
};
export const setThursday = (thursday) => {
  selectedDays.thursday = thursday;
  scheduleSetSettings();
};
export const setFriday = (friday) => {
  selectedDays.friday = friday;
  scheduleSetSettings();
};
export const setSaturday = (saturday) => {
  selectedDays.saturday = saturday;
  scheduleSetSettings();
};
export const setSunday = (sunday) => {
  selectedDays.sunday = sunday;
  scheduleSetSettings();
};
export const setAutoAddTime = (time) => {
  autoAddTime = time;
  scheduleSetSettings();
};

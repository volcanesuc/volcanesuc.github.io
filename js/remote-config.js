// js/remote-config.js
import { getRemoteConfig, fetchAndActivate, getValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-remote-config.js";
import { app } from "./firebase.js";

const PARAM_NAME = "header_tabs_config";

export async function loadHeaderTabsConfig() {
  const rc = getRemoteConfig(app);

  // En dev podés dejarlo bajo. En prod subilo (ej 1h = 3600000)
  rc.settings = {
    fetchTimeoutMillis: 10000,
    minimumFetchIntervalMillis: 0,
  };

  // Default seguro si todavía no publicaste o falla el fetch
  rc.defaultConfig = {
    [PARAM_NAME]: JSON.stringify({ version: 1, enabledTabs: {} }),
  };

  await fetchAndActivate(rc);

  const raw = getValue(rc, PARAM_NAME).asString();

  try {
    return JSON.parse(raw);
  } catch {
    return { version: 1, enabledTabs: {} };
  }
}

export function filterMenuByConfig(menu, cfg) {
  const enabledTabs = cfg?.enabledTabs || {};
  // Si no está definido en config, lo dejamos visible (default = true)
  return menu.filter(item => enabledTabs[item.id] !== false);
}

export function isPageEnabled(pageId, cfg) {
  const enabled = cfg?.enabledTabs?.[pageId];
  return enabled !== false; // default true
}

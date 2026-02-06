import { loadHeaderTabsConfig, isTabEnabled } from "./remote-config.js";
import { PAGE_CONFIG } from "./page-config.js";

export async function guardPage(pageKey) {
  const cfg = await loadHeaderTabsConfig();

  const page = PAGE_CONFIG[pageKey];
  if (!page) return;

  if (!isTabEnabled(page.id, cfg)) {
    window.location.href = "dashboard.html";
  }
}
import { loadHeaderTabsConfig, isTabEnabled } from "./remote-config.js";
import { PAGE_CONFIG, HOME_HREF } from "./config/page-config.js";

export async function guardPage(pageKey) {
  const cfg = await loadHeaderTabsConfig();
  const page = PAGE_CONFIG[pageKey];
  if (!page) return { cfg };

  if (!isTabEnabled(page.tabId, cfg)) {
    window.location.href = HOME_HREF;
    return { cfg, redirected: true };
  }
  return { cfg, redirected: false };
}
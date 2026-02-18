// header.js
import { logout } from "../auth.js";
import { CLUB_DATA } from "../strings.js";
import { loadHeaderTabsConfig, filterMenuByConfig } from "../remote-config.js";

export async function loadHeader(activeTab, cfgOverride) {
  const header = document.getElementById("app-header");
  if (!header) return;

  const MENU = CLUB_DATA.header.menu;
  const HOME_HREF = toAbsHref(CLUB_DATA.header.homeHref || "dashboard.html");

  //usa cfgOverride si viene; si no, intenta remote config; si falla, fallback
  let cfg = cfgOverride;
  if (!cfg) {
    try {
      cfg = await loadHeaderTabsConfig();
    } catch (e) {
      console.warn("Remote config failed, fallback local", e);
      cfg = { enabledTabs: {} };
    }
  }

  const VISIBLE_MENU = filterMenuByConfig(MENU, cfg);

  const renderLinksDesktop = () =>
    VISIBLE_MENU.map(
      item => `
        <a href="${toAbsHref(item.href)}" class="top-tab ${activeTab === item.id ? "active" : ""}">
          ${item.label}
        </a>
      `
    ).join("");

  const renderLinksMobile = () =>
    VISIBLE_MENU.map(
      item => `
        <a href="${toAbsHref(item.href)}" class="mobile-link ${activeTab === item.id ? "active" : ""}">
          ${item.label}
        </a>
      `
    ).join("");

  header.innerHTML = `
    <header class="topbar">
      <div class="left">
        <button
          class="hamburger"
          type="button"
          data-bs-toggle="offcanvas"
          data-bs-target="#mobileMenu"
          aria-controls="mobileMenu"
          aria-label="Abrir menú"
        >☰</button>

        <a class="logo logo-link" href="${HOME_HREF}" title="Ir al inicio">
          ${CLUB_DATA.header.logoText}
        </a>
      </div>

      <nav class="top-tabs">
        ${renderLinksDesktop()}
      </nav>

      <button id="logoutBtn" class="logout-btn">
        ${CLUB_DATA.header.logout.label}
      </button>
    </header>

    <div class="offcanvas offcanvas-start" tabindex="-1" id="mobileMenu" aria-labelledby="mobileMenuLabel">
      <div class="offcanvas-header">
        <a class="offcanvas-title logo-link" id="mobileMenuLabel" href="${HOME_HREF}" title="Ir al inicio">
          ${CLUB_DATA.header.mobileTitle}
        </a>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button>
      </div>

      <div class="offcanvas-body">
        <div class="mobile-links">
          ${renderLinksMobile()}
        </div>
        <hr />
        <button class="btn btn-outline-primary w-100 mt-2" id="logoutBtnMobile">
          ${CLUB_DATA.header.logout.label}
        </button>
      </div>
    </div>
  `;

  bindHeaderEvents();
}

function bindHeaderEvents() {
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("logoutBtnMobile")?.addEventListener("click", logout);
}

function toAbsHref(href) {
  if (!href) return "#";
  // ya es absoluta o externa
  if (href.startsWith("/") || href.startsWith("http://") || href.startsWith("https://")) return href;
  // hash o query “puro”
  if (href.startsWith("#") || href.startsWith("?")) return href;
  // convierte "roster.html" -> "/roster.html"
  return `/${href}`;
}
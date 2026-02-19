// js/components/header.js
import { logout } from "../auth.js";
import { CLUB_DATA } from "../strings.js";
import { loadHeaderTabsConfig, filterMenuByConfig } from "../remote-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/*
  Header único (sin HTML separado):
  - Renderiza tabs (filtrados por remote config si existe)
  - Renderiza CTA dinámico según sesión:
      * NO logueado: Ingresar + Crear cuenta
      * Logueado: Salir (y opcional: Dashboard si estás en index)
*/

export async function loadHeader(activeTab, cfgOverride) {
  const header = document.getElementById("app-header");
  if (!header) return;

  const auth = getAuth();

  const MENU = CLUB_DATA.header.menu || [];
  const HOME_HREF = toAbsHref(CLUB_DATA.header.homeHref || "dashboard.html");

  // usa cfgOverride si viene; si no, intenta remote config; si falla, fallback
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
      (item) => `
        <a href="${toAbsHref(item.href)}" class="top-tab ${activeTab === item.id ? "active" : ""}">
          ${item.label}
        </a>
      `
    ).join("");

  const renderLinksMobile = () =>
    VISIBLE_MENU.map(
      (item) => `
        <a href="${toAbsHref(item.href)}" class="mobile-link ${activeTab === item.id ? "active" : ""}">
          ${item.label}
        </a>
      `
    ).join("");

  // CTA placeholders: se llena con onAuthStateChanged
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
          ${CLUB_DATA.header.logoText || "Volcanes"}
        </a>
      </div>

      <nav class="top-tabs">
        ${renderLinksDesktop()}
      </nav>

      <div class="header-cta d-flex align-items-center gap-2" id="headerCta">
        <!-- auth buttons -->
      </div>
    </header>

    <div class="offcanvas offcanvas-start" tabindex="-1" id="mobileMenu" aria-labelledby="mobileMenuLabel">
      <div class="offcanvas-header">
        <a class="offcanvas-title logo-link" id="mobileMenuLabel" href="${HOME_HREF}" title="Ir al inicio">
          ${CLUB_DATA.header.mobileTitle || CLUB_DATA.header.logoText || "Volcanes"}
        </a>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button>
      </div>

      <div class="offcanvas-body">
        <div class="mobile-links">
          ${renderLinksMobile()}
        </div>

        <hr />

        <div class="d-grid gap-2" id="mobileCta">
          <!-- auth buttons -->
        </div>
      </div>
    </div>
  `;

  // Pinta botones según sesión (una sola fuente de verdad)
  onAuthStateChanged(auth, (user) => {
    const cta = document.getElementById("headerCta");
    const mcta = document.getElementById("mobileCta");
    if (!cta || !mcta) return;

    const loginHref = toAbsHref(CLUB_DATA.header?.cta?.login?.href || "login.html");
    const registerHref = toAbsHref(CLUB_DATA.header?.cta?.register?.href || "register.html");
    const dashHref = toAbsHref(CLUB_DATA.header?.homeHref || "dashboard.html");

    if (!user) {
      // NO logueado: Ingresar + Crear cuenta
      cta.innerHTML = `
        <a href="${loginHref}" class="btn btn-outline-dark btn-sm">
          ${CLUB_DATA.header?.cta?.login?.label || "Ingresar"}
        </a>
        <a href="${registerHref}" class="btn btn-dark btn-sm">
          ${CLUB_DATA.header?.cta?.register?.label || "Crear cuenta"}
        </a>
      `;

      mcta.innerHTML = `
        <a href="${loginHref}" class="btn btn-outline-dark w-100">
          ${CLUB_DATA.header?.cta?.login?.label || "Ingresar"}
        </a>
        <a href="${registerHref}" class="btn btn-dark w-100">
          ${CLUB_DATA.header?.cta?.register?.label || "Crear cuenta"}
        </a>
      `;
      return;
    }

    // Logueado: Dashboard (si estás en index) + Salir
    const isIndex =
      location.pathname.endsWith("/index.html") ||
      location.pathname === "/" ||
      location.pathname.endsWith("/");

    cta.innerHTML = `
      ${isIndex ? `<a href="${dashHref}" class="btn btn-dark btn-sm">Dashboard</a>` : ""}
      <button id="logoutBtn" class="logout-btn">
        ${CLUB_DATA.header?.logout?.label || "Salir"}
      </button>
    `;

    mcta.innerHTML = `
      ${isIndex ? `<a href="${dashHref}" class="btn btn-dark w-100">Dashboard</a>` : ""}
      <button class="btn btn-outline-primary w-100 mt-2" id="logoutBtnMobile">
        ${CLUB_DATA.header?.logout?.label || "Salir"}
      </button>
    `;

    bindHeaderEvents(); // re-bindea porque el DOM de botones cambió
  });
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

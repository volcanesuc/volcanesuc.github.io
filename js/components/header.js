// js/components/header.js
import "../firebase.js"; // ✅ asegura init de Firebase antes de getAuth()
import { loginWithGoogle, logout } from "../auth.js";
import { CLUB_DATA } from "../strings.js";
import { loadHeaderTabsConfig, filterMenuByConfig } from "../remote-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/*
  Header único (sin HTML separado):
  - Tabs filtrados por remote config
  - CTA según sesión:
      * NO logueado: Google + Crear cuenta
      * Logueado: (Dashboard si index) + Salir (con tu estilo)
*/

export async function loadHeader(activeTab, cfgOverride) {
  const header = document.getElementById("app-header");
  if (!header) return;

  const auth = getAuth();

  const MENU = CLUB_DATA.header.menu || [];
  const HOME_HREF = toAbsHref(CLUB_DATA.header.homeHref || "dashboard.html");

  // cfgOverride > remote config > fallback
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

      <div class="header-cta d-flex align-items-center gap-2" id="headerCta"></div>
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

        <div class="d-grid gap-2" id="mobileCta"></div>
      </div>
    </div>
  `;

  onAuthStateChanged(auth, (user) => {
    const cta = document.getElementById("headerCta");
    const mcta = document.getElementById("mobileCta");
    if (!cta || !mcta) return;

    const registerHref = toAbsHref(CLUB_DATA.header?.cta?.register?.href || "pages/register.html");
    const dashHref = toAbsHref(CLUB_DATA.header?.homeHref || "dashboard.html");
    const logoutLabel = CLUB_DATA.header?.logout?.label || "SALIR";

    if (!user) {
      // ✅ NO logueado: Google + Crear cuenta
      cta.innerHTML = `
        <button id="googleLoginBtn" class="btn btn-light btn-sm d-flex align-items-center gap-2">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="16" height="16" alt="Google">
          Ingresar con Google
        </button>
        <a href="${registerHref}" class="btn btn-outline-light btn-sm">
          ${CLUB_DATA.header?.cta?.register?.label || "Crear cuenta"}
        </a>
      `;

      mcta.innerHTML = `
        <button id="googleLoginBtnMobile" class="btn btn-light w-100 d-flex align-items-center justify-content-center gap-2">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="16" height="16" alt="Google">
          Ingresar con Google
        </button>
        <a href="${registerHref}" class="btn btn-outline-light w-100 mt-2">
          ${CLUB_DATA.header?.cta?.register?.label || "Crear cuenta"}
        </a>
      `;

      document.getElementById("googleLoginBtn")?.addEventListener("click", loginWithGoogle);
      document.getElementById("googleLoginBtnMobile")?.addEventListener("click", loginWithGoogle);
      return;
    }

    // ✅ Logueado: Dashboard (solo si estás en index) + Salir (tu estilo)
    const isIndex =
      location.pathname === "/" ||
      location.pathname.endsWith("/index.html") ||
      location.pathname.endsWith("/");

    cta.innerHTML = `
      ${isIndex ? `<a href="${dashHref}" class="btn btn-dark btn-sm">Dashboard</a>` : ""}
      <button id="logoutBtn" class="logout-btn">${logoutLabel}</button>
    `;

    mcta.innerHTML = `
      ${isIndex ? `<a href="${dashHref}" class="btn btn-dark w-100">Dashboard</a>` : ""}
      <button class="btn btn-outline-primary w-100 mt-2" id="logoutBtnMobile">${logoutLabel}</button>
    `;

    bindHeaderEvents();
  });
}

function bindHeaderEvents() {
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("logoutBtnMobile")?.addEventListener("click", logout);
}

function toAbsHref(href) {
  if (!href) return "#";
  if (href.startsWith("/") || href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("#") || href.startsWith("?")) return href;
  return `/${href}`;
}

// js/components/header.js
import { auth } from "../auth/firebase.js";
import { loginWithGoogle, logout } from "../auth/auth.js";
import { routeAfterGoogleLogin } from "../auth/role-routing.js";

import { CLUB_DATA } from "../strings.js";
import { loadHeaderTabsConfig, filterMenuByConfig } from "../remote-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/*
  Header único (sin HTML separado):
  - Tabs filtrados por remote config
  - CTA según sesión:
      * NO logueado: "Ingresar con Google" + "Crear cuenta"
      * Logueado: "Salir" (y si estás en index, te rutea automáticamente por roles)
*/

export async function loadHeader(activeTab, cfgOverride) {
  const header = document.getElementById("app-header");
  if (!header) return;

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

  const isOverride = !!cfgOverride;
  const VISIBLE_MENU = isOverride ? filterMenuStrict(MENU, cfg) : filterMenuByConfig(MENU, cfg);

  function filterMenuStrict(menu, cfg) {
    const enabled = cfg?.enabledTabs || {};
    return (menu || []).filter(item => enabled[item.id] === true);
  }

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

  onAuthStateChanged(auth, async (user) => {
    const cta = document.getElementById("headerCta");
    const mcta = document.getElementById("mobileCta");
    if (!cta || !mcta) return;

    const registerHref = toAbsHref(CLUB_DATA.header?.cta?.register?.href || "public/register.html");
    const logoutLabel = CLUB_DATA.header?.logout?.label || "SALIR";

    const isIndex =
      location.pathname === "/" ||
      location.pathname.endsWith("/index.html") ||
      location.pathname.endsWith("/");

    if (!user) {
      // NO logueado: Google + Crear cuenta
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

      const doLoginAndRoute = async () => {
        try {
          const u = await loginWithGoogle();
          if (!u?.uid) throw new Error("No uid from login");
          await routeAfterGoogleLogin(u); // ✅ aquí vive todo el flow
        } catch (e) {
          console.error(e);
          alert("No se pudo iniciar sesión con Google.");
        }
      };

      document.getElementById("googleLoginBtn")?.addEventListener("click", doLoginAndRoute);
      document.getElementById("googleLoginBtnMobile")?.addEventListener("click", doLoginAndRoute);
      return;
    }

    // ✅ si ya está logueado y está en index, aplicamos flow por roles (dashboard o register)
    if (isIndex) {
      try {
        await routeAfterGoogleLogin(user);
      } catch (e) {
        console.error(e);
        // fallback: si algo raro pasa, al menos no lo dejamos pegado sin UI
      }
      return;
    }

    // ✅ páginas internas: solo salir
    cta.innerHTML = `
      <button id="logoutBtn" class="logout-btn">${logoutLabel}</button>
    `;

    mcta.innerHTML = `
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
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("#") || href.startsWith("?")) return href;

  const base =
    document.querySelector("base")?.href ||
    window.location.origin + window.location.pathname.replace(/[^/]*$/, "");

  const u = new URL(href, base);
  return u.pathname + u.search + u.hash;
}
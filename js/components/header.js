// header.js
// Header global con tabs desktop + offcanvas mobile (Bootstrap)

import { logout } from "../auth.js";
import { CLUB_DATA } from "../strings.js";

/* =========================================================
   HEADER RENDER
========================================================= */

export function loadHeader(activeTab) {
  document.body.classList.add("app-shell");
  const header = document.getElementById("app-header");
  if (!header) return;

  const MENU = CLUB_DATA.header.menu || [];
  const HOME_HREF = CLUB_DATA.header.homeHref || "dashboard.html";

  const renderLinksDesktop = () =>
    MENU.map(
      item => `
        <a href="${item.href}" class="${activeTab === item.id ? "active" : ""}">
          ${item.label}
        </a>
      `
    ).join("");

  const renderLinksMobile = () =>
  MENU.map(
    item => `
      <a
        href="${item.href}"
        class="${activeTab === item.id ? "active" : ""}"
      >
        ${item.label}
      </a>
    `
  ).join("");

  header.innerHTML = `
    <header class="topbar">
      <div class="d-flex align-items-center gap-2">
        <button
          class="hamburger"
          type="button"
          data-bs-toggle="offcanvas"
          data-bs-target="#mobileMenu"
          aria-controls="mobileMenu"
          aria-label="Abrir menú"
        >
          ☰
        </button>

        <a class="logo logo-link" href="${HOME_HREF}" title="Ir al inicio">
          ${CLUB_DATA.header.logoText}
        </a>
      </div>

      <nav class="nav-tabs">
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

/* =========================================================
   EVENTS
========================================================= */
  // Debug: confirmar hrefs mobile
  const mobileLinks = [...document.querySelectorAll("#mobileMenu .mobile-links a")].map(a => a.getAttribute("href"));
  console.log("[header] mobile links:", mobileLinks);
}

function bindHeaderEvents() {
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("logoutBtnMobile")?.addEventListener("click", logout);
}

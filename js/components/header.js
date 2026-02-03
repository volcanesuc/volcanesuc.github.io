// header.js
// Header global con tabs desktop + offcanvas mobile (Bootstrap)

import { logout } from "../auth.js";
import { CLUB_DATA } from "../strings.js";

/* =========================================================
   HEADER RENDER
========================================================= */

export function loadHeader(activeTab) {
  const header = document.getElementById("app-header");
  if (!header) return;

  const MENU = CLUB_DATA.header.menu;

  // ✅ Home target (puedes cambiar a "index.html" si ese es tu home real)
  const HOME_HREF = CLUB_DATA.header.homeHref || "dashboard.html";

  const renderLinks = () =>
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
        <!-- HAMBURGER -->
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

        <!-- ✅ LOGO clickeable -->
        <a class="logo logo-link" href="${HOME_HREF}" title="Ir al inicio">
          ${CLUB_DATA.header.logoText}
        </a>
      </div>

      <!-- DESKTOP NAV -->
      <nav class="nav-tabs">
        ${renderLinks()}
      </nav>

      <button id="logoutBtn" class="logout-btn">
        ${CLUB_DATA.header.logout.label}
      </button>
    </header>

    <!-- OFFCANVAS MOBILE -->
    <div
      class="offcanvas offcanvas-start"
      tabindex="-1"
      id="mobileMenu"
      aria-labelledby="mobileMenuLabel"
    >
      <div class="offcanvas-header">
        <!-- ✅ también clickeable en mobile -->
        <a class="offcanvas-title logo-link" id="mobileMenuLabel" href="${HOME_HREF}" title="Ir al inicio">
          ${CLUB_DATA.header.mobileTitle}
        </a>

        <button
          type="button"
          class="btn-close"
          data-bs-dismiss="offcanvas"
          aria-label="${CLUB_DATA.header.logout.label}"
        ></button>
      </div>

      <div class="offcanvas-body">
        ${renderLinks()}
        <hr />
        <button class="btn btn-outline-primary w-100 mt-2" id="logoutBtnMobile">
          ${CLUB_DATA.header.logout.label}
        </button>
      </div>
    </div>
  `;

  bindHeaderEvents();
}

/* =========================================================
   EVENTS
========================================================= */

function bindHeaderEvents() {
  // logout desktop
  document.getElementById("logoutBtn")?.addEventListener("click", logout);

  // logout mobile
  document.getElementById("logoutBtnMobile")?.addEventListener("click", logout);

  // cerrar offcanvas al clickear un link
  const offcanvasEl = document.getElementById("mobileMenu");

  offcanvasEl?.querySelectorAll("a")?.forEach(link => {
    link.addEventListener("click", () => {
      const instance = bootstrap.Offcanvas.getInstance(offcanvasEl);
      instance?.hide();
    });
  });
}

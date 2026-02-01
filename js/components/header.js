// header.js
// Header global con tabs desktop + offcanvas mobile (Bootstrap)

import { logout } from "../auth.js";

/* =========================================================
   CONFIG
========================================================= */

const MENU = [
  { id: "home", label: "Home", href: "dashboard.html" },
  { id: "roster", label: "Roster", href: "roster.html" },
  { id: "trainings", label: "Entrenamientos", href: "trainings.html" },
  { id: "attendance", label: "Asistencia", href: "attendance.html" },
  { id: "tournaments", label: "Torneos", href: "dashboard.html#tournaments" },
  { id: "stats", label: "Estadísticas", href: "stats2024.html" }
];

/* =========================================================
   HEADER RENDER
========================================================= */

export function loadHeader(activeTab) {
  const header = document.getElementById("app-header");
  if (!header) return;

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
        >
          ☰
        </button>

        <div class="logo">Volcanes</div>
      </div>

      <!-- DESKTOP NAV -->
      <nav class="nav-tabs">
        ${renderLinks()}
      </nav>

      <button id="logoutBtn" class="logout-btn">
        Salir
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
        <h5 class="offcanvas-title" id="mobileMenuLabel">
          Volcanes Ultimate
        </h5>
        <button
          type="button"
          class="btn-close"
          data-bs-dismiss="offcanvas"
          aria-label="Cerrar"
        ></button>
      </div>

      <div class="offcanvas-body">
        ${renderLinks()}
        <hr />
        <button class="btn btn-outline-primary w-100 mt-2" id="logoutBtnMobile">
          Salir
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
  document
    .getElementById("logoutBtn")
    ?.addEventListener("click", logout);

  // logout mobile
  document
    .getElementById("logoutBtnMobile")
    ?.addEventListener("click", logout);

  // cerrar offcanvas al clickear un link
  const offcanvasEl = document.getElementById("mobileMenu");

  offcanvasEl
    ?.querySelectorAll("a")
    .forEach(link => {
      link.addEventListener("click", () => {
        const instance =
          bootstrap.Offcanvas.getInstance(offcanvasEl);
        instance?.hide();
      });
    });
}

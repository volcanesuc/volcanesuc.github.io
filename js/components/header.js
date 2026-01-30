const MENU = [
  { id: "home", label: "Home", href: "dashboard.html" },
  { id: "roster", label: "Roster", href: "roster.html" },
  { id: "trainings", label: "Entrenamientos", href: "trainings.html" },
  { id: "attendance", label: "Asistencia", href: "attendance.html" },
  { id: "tournaments", label: "Torneos", href: "dashboard.html#tournaments" },
  { id: "stats", label: "Estadísticas", href: "stats2024.html" }
];

export function loadHeader(activeTab) {
  const container = document.getElementById("app-header");
  if (!container) return;

  // 🛑 evita duplicados
  if (container.children.length > 0) return;

  const renderLinks = (isMobile = false) =>
    MENU.map(item => `
      <a
        href="${item.href}"
        class="${!isMobile && activeTab === item.id ? "active" : ""}"
      >
        ${item.label}
      </a>
    `).join("");

  container.innerHTML = `
    <header class="topbar">
      <div class="left">
        <button id="menuBtn" class="hamburger">☰</button>
        <span class="logo">Volcanes Ultimate</span>
      </div>

      <nav class="nav-tabs">
        ${renderLinks()}
      </nav>

      <button id="logoutBtn" class="logout-btn">SALIR</button>
    </header>

    <nav id="mobileMenu" class="mobile-menu">
      ${renderLinks(true)}
    </nav>
  `;

  setupMobileMenu();
}

function setupMobileMenu() {
  const btn = document.getElementById("menuBtn");
  const menu = document.getElementById("mobileMenu");

  if (!btn || !menu) return;

  btn.onclick = () => {
    menu.classList.toggle("open");
  };
}
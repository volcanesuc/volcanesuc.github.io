export function loadHeader(activeTab) {
  const container = document.getElementById("app-header");
  if (!container) return;

  // 🛑 evita duplicados
  if (container.children.length > 0) return;

  container.innerHTML = `
    <header class="topbar">
      <div class="left">
        <button id="menuBtn" class="hamburger">☰</button>
        <span class="logo">Volcanes Ultimate</span>
      </div>

      <nav class="nav-tabs">
        <a class="${activeTab === "home" ? "active" : ""}" href="dashboard.html">Home</a>
        <a class="${activeTab === "attendance" ? "active" : ""}" href="attendance.html">Asistencia</a>
        <a class="${activeTab === "tournaments" ? "active" : ""}" href="dashboard.html#tournaments">Torneos</a>
        <a class="${activeTab === "stats" ? "active" : ""}" href="stats2024.html">Estadísticas</a>
      </nav>

      <button id="logoutBtn" class="logout-btn">SALIR</button>
    </header>

    <nav id="mobileMenu" class="mobile-menu">
      <a href="dashboard.html">Home</a>
      <a href="attendance.html">Asistencia</a>
      <a href="dashboard.html#tournaments">Torneos</a>
      <a href="stats2024.html">Estadísticas</a>
    </nav>
  `;
}

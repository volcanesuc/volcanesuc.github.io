export function loadHeader(activeTab) {
  const headerHTML = `
    <header class="topbar">
      <div class="left">
        <button id="menuBtn" class="hamburger">☰</button>
        <span class="logo">Volcanes Ultimate</span>
      </div>

      <nav class="nav-tabs">
        <a data-tab="home" class="${activeTab === "home" ? "active" : ""}" href="dashboard.html">Home</a>
        <a data-tab="players" class="${activeTab === "players" ? "active" : ""}" href="dashboard.html#players">Jugadores</a>
        <a data-tab="attendance" class="${activeTab === "attendance" ? "active" : ""}" href="attendance.html">Asistencia</a>
        <a data-tab="tournaments" class="${activeTab === "tournaments" ? "active" : ""}" href="dashboard.html#tournaments">Torneos</a>
        <a data-tab="stats" class="${activeTab === "stats" ? "active" : ""}" href="stats2024.html">Estadísticas</a>
      </nav>

      <button id="logoutBtn" class="logout-btn">SALIR</button>
    </header>

    <nav id="mobileMenu" class="mobile-menu">
      <a href="dashboard.html">Home</a>
      <a href="dashboard.html#players">Jugadores</a>
      <a href="attendance.html">Asistencia</a>
      <a href="dashboard.html#tournaments">Torneos</a>
      <a href="stats2024.html">Estadísticas</a>
    </nav>
  `;

  document.body.insertAdjacentHTML("afterbegin", headerHTML);
}

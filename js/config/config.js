//js\config\config.js
// 
export const APP_CONFIG = {
  version: "0.3",

  club: {
    id: "Club",
    name: "Club Ultimate",
    playersCollection: "club_players",
    tournamentsCollection: "tournaments",
    trainingsCollection: "trainings"
  },

  sport: "ultimate",

  playerRoles: [
    { id: "handler", label: "Handler" },
    { id: "cutter",  label: "Cutter" },
    { id: "hybrid",  label: "Hybrid" }
  ],

  //deben ser reemplazados tambien en: main.css -> root para que carguen por defecto
  theme: {
    colors: {
      primary: "#7c3aed38",
      primaryDark: "#3a157938",
      primaryLight: "#7c3aed",
      accent: "#22d3ee",
      accentSoft: "#66daec",
      clubGray: "#f4f4f4",
      bg: "#f5f6f8",
      bgSoft: "#fafafa",
      card: "#ffffff",
      text: "#1f2328",
      textSoft: "#6b7280",
      border: "#e5e7eb"
    },

    font: {
      name: "ClubFont",
      url: "/fonts/club-font.woff2",
      ttf: "/fonts/club-font.ttf"
    },

    logo: "/img/logos/club_logo.png"
  },
  // Firebase (centralizado)
  firebase: {
    apiKey: "TODO",
    authDomain: "TODO",
    projectId: "TODO",
    storageBucket: "TODO",
    messagingSenderId: "TODO",
    appId: "TODO",
    measurementId: "TODO"
  }
};

/* ========================================
   APPLY THEME AUTO (runs on import)
======================================== */
function applyThemeFromConfig() {
  const t = APP_CONFIG?.theme;
  if (!t) return;

  const root = document.documentElement;
  const c = t.colors || {};

  /* 🎨 map config -> CSS variables existentes */
  const map = {
    primary: "--theme-primary",
    primaryDark: "--theme-primary-dark",
    primaryLight: "--theme-primary-light",
    accent: "--theme-accent",
    clubGray: "--theme-gray",

    bg: "--bg",
    bgSoft: "--bg-soft",
    card: "--card",
    text: "--text",
    textSoft: "--text-soft",
    border: "--border"
  };

  for (const [key, cssVar] of Object.entries(map)) {
    if (c[key]) root.style.setProperty(cssVar, c[key]);
  }

  /* FONT (solo títulos) */
  if (t.font?.name) {
    root.style.setProperty(
      "--font-title",
      `"${t.font.name}", system-ui, -apple-system, sans-serif`
    );
  }

  /* 🖼 logo dinámico */
  if (t.logo) {
    document.querySelectorAll(".club-logo").forEach(img => {
      img.src = t.logo;
    });
  }
}

/* auto run solo en browser */
if (typeof window !== "undefined") {
  applyThemeFromConfig();
}

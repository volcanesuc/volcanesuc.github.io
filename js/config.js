export const APP_CONFIG = {
  version: "0.3",

  club: {
    id: "volcanes",
    name: "Volcanes Ultimate",
    playersCollection: "club_players",
    tournamentsCollection: "tournaments",
    trainingsCollection: "trainings"
  },

  theme: {
    colors: {
      primary: "#d13b27",
      primaryDark: "#12352f",
      primaryLight: "#2c6b61",
      accent: "#e8ce26",
      accentSoft: "#f4e47a",
      clubGray: "#f4f4f4",
      bg: "#0b0f0e",
      bgSoft: "#111716",
      card: "#151c1a",
      text: "#ffffff",
      textSoft: "#b7c9c5",
      border: "#1f2a28"
    },

    font: {
      name: "Recons",
      url: "/fonts/Recons-Regular.woff2",
      ttf: "/fonts/Recons-Regular.ttf"
    },

    logo: "/img/logos/volcano_logo.jpg"
  },
  // Firebase (centralizado)
  firebase: {
    apiKey: "AIzaSyABSy5kImaF9VyNisu2vkihm2y4mfYGodw",
    authDomain: "rifavolcanes.firebaseapp.com",
    projectId: "rifavolcanes",
    storageBucket: "rifavolcanes.firebasestorage.app",
    messagingSenderId: "991215068881",
    appId: "1:991215068881:web:6fb46dab34bf1a572a47f0",
    measurementId: "G-6ZYXBJW3JY"
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
    primary: "--club-green",
    primaryDark: "--club-green-dark",
    primaryLight: "--club-green-light",
    accent: "--club-yellow",
    clubGray: "--club-gray",

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

  /* 🔤 FONT dinámica */
  if (t.font?.name) {
    root.style.setProperty(
      "--font-title",
      `"${t.font.name}", system-ui, -apple-system, sans-serif`
    );
    document.body.style.fontFamily =
      `"${t.font.name}", system-ui, -apple-system, sans-serif`;
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

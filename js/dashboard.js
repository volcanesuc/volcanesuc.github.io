import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { loadHeader } from "./components/header.js";



loadHeader("home");

watchAuth(async () => {
  showLoader();
  try {
    await loadData(); // 👈 esta función ya es async
  } finally {
    hideLoader();
  }
});

const birthdaysList = document.getElementById("birthdaysList");
const currentMonth = new Date().getMonth();

watchAuth(() => loadDashboard());
document.getElementById("logoutBtn")?.addEventListener("click", logout);

async function loadDashboard() {
  showLoader();

  try {
    const snap = await getDocs(collection(db, "club_players"));
    const players = {};

    snap.forEach(d => {
      players[d.id] = {
        name: d.data().name,
        birthday: d.data().birthday
      };
    });

    renderBirthdays(players);
  } finally {
    hideLoader();
  }
}

function parseBirthday(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d) ? null : { month: d.getMonth(), day: d.getDate() };
}

function renderBirthdays(players) {
  const today = new Date();

  const list = Object.values(players)
    .map(p => ({ ...p, ...parseBirthday(p.birthday) }))
    .filter(p => p.month === currentMonth)
    .sort((a, b) => a.day - b.day);

  birthdaysList.innerHTML = list.length
    ? list.map(p =>
        `🎂 <strong>${p.name}</strong> — ${p.day}${p.day === today.getDate() ? " (HOY 🎉)" : ""}`
      ).join("<br>")
    : "No hay cumpleañeros este mes 🎈";
}

document.getElementById("appVersion").textContent = `v${APP_CONFIG.version}`;

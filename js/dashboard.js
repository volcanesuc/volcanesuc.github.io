import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { loadHeader } from "./components/header.js";
import { Player } from "./models/player.js";


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
    const players = [];

    snap.forEach(doc => {
      players.push(Player.fromFirestore(doc));
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

  const list = players
    .map(p => {
      const parsed = parseBirthday(p.birthday);
      return parsed ? { player: p, ...parsed } : null;
    })
    .filter(Boolean)
    .filter(p => p.month === currentMonth)
    .sort((a, b) => a.day - b.day);

  birthdaysList.innerHTML = list.length
    ? list.map(({ player, day }) =>
        `🎂 <strong>${player.fullName}</strong> — ${day}${day === today.getDate() ? " (HOY 🎉)" : ""}`
      ).join("<br>")
    : "No hay cumpleañeros este mes 🎈";
}


document.getElementById("appVersion").textContent = `v${APP_CONFIG.version}`;

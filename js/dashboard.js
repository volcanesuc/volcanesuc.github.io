// dashboard.js
// Dashboard principal: carga jugadores, entrenamientos, KPIs y cumpleaños

import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { loadHeader } from "./components/header.js";
import { Player } from "./models/player.js";

/* =========================================================
   INIT
========================================================= */

loadHeader("home");

watchAuth(async () => {
  showLoader();
  try {
    await loadDashboard();
  } finally {
    hideLoader();
  }
});

document.getElementById("logoutBtn")?.addEventListener("click", logout);

/* =========================================================
   DASHBOARD LOAD
========================================================= */

async function loadDashboard() {
  // Cargar jugadores
  const playersSnap = await getDocs(collection(db, "club_players"));
  const players = playersSnap.docs.map(doc =>
    Player.fromFirestore(doc)
  );

  // Cargar entrenamientos
  const trainingsSnap = await getDocs(collection(db, "trainings"));
  const trainings = trainingsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Render cumpleaños
  renderBirthdays(players);

  // Calcular y render KPIs
  const kpis = calculateMonthlyKPIs({ players, trainings });
  renderKPIs(kpis);
}

/* =========================================================
   BIRTHDAYS
========================================================= */

const birthdaysList = document.getElementById("birthdaysList");
const currentMonth = new Date().getMonth();

function parseBirthday(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d) ? null : { month: d.getMonth(), day: d.getDate() };
}

function renderBirthdays(players) {
  const today = new Date();

  const list = players
    .map(player => {
      const parsed = parseBirthday(player.birthday);
      return parsed ? { player, ...parsed } : null;
    })
    .filter(Boolean)
    .filter(p => p.month === currentMonth)
    .sort((a, b) => a.day - b.day);

  birthdaysList.innerHTML = list.length
    ? list
        .map(
          ({ player, day }) =>
            `<strong>${player.fullName}</strong> — ${day}${
              day === today.getDate() ? " (HOY)" : ""
            }`
        )
        .join("<br>")
    : "No hay cumpleañeros este mes";
}

/* =========================================================
   KPIs
========================================================= */

function calculateMonthlyKPIs({ players, trainings }) {
  const monthKey = getCurrentMonthKey();

  // Entrenamientos activos del mes
  const monthlyTrainings = trainings.filter(
    t => t.active === true && t.month === monthKey
  );

  // Asistencia promedio por entrenamiento
  const totalAttendance = monthlyTrainings.reduce(
    (sum, t) => sum + (t.attendees?.length ?? 0),
    0
  );

  const avgAttendance = monthlyTrainings.length
    ? Math.round(totalAttendance / monthlyTrainings.length)
    : 0;

  // Jugadores activos del mes (IDs únicos)
  const activePlayerIds = new Set();
  monthlyTrainings.forEach(t => {
    (t.attendees || []).forEach(id => activePlayerIds.add(id));
  });

  const activePlayers = activePlayerIds.size;

  // Jugadores nuevos registrados este mes
  const newPlayers = players.filter(p => {
    if (!p.createdAt) return false;
    const d = p.createdAt.toDate?.() ?? new Date(p.createdAt);
    return (
      d.getFullYear() === Number(monthKey.slice(0, 4)) &&
      d.getMonth() + 1 === Number(monthKey.slice(5))
    );
  }).length;

  return {
    activePlayers,
    avgAttendance,
    newPlayers
  };
}

function renderKPIs(kpis) {
  document.getElementById("kpiActivePlayers").textContent =
    kpis.activePlayers;

  document.getElementById("kpiAvgAttendance").textContent =
    kpis.avgAttendance;

  document.getElementById("kpiNewPlayers").textContent =
    kpis.newPlayers;
}

/* =========================================================
   HELPERS
========================================================= */

function getCurrentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* =========================================================
   VERSION
========================================================= */

document.getElementById("appVersion").textContent =
  `v${APP_CONFIG.version}`;

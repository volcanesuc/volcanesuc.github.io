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

  const alerts = calculateAlerts({ players, trainings });
  renderAlerts(alerts);
}

/* =========================================================
   BIRTHDAYS
========================================================= */

const birthdaysList = document.getElementById("birthdaysList");
const currentMonth = new Date().getMonth();

function parseBirthday(str) {
  if (!str) return null;

  // Espera formato YYYY-MM-DD
  const [year, month, day] = str.split("-").map(Number);

  if (!year || !month || !day) return null;

  return {
    month: month - 1, // JS usa 0–11
    day
  };
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

  // Asistencia total del mes
  const totalAttendance = monthlyTrainings.reduce(
    (sum, t) => sum + (t.attendees?.length ?? 0),
    0
  );

  // Promedio por entrenamiento
  const avgAttendance = monthlyTrainings.length
    ? Math.round(totalAttendance / monthlyTrainings.length)
    : 0;

  // IDs de jugadores activos en el roster
  const activeRosterIds = new Set(
    players.filter(p => p.active).map(p => p.id)
  );

  // IDs únicos de jugadores activos que sí participaron
  const activeParticipants = new Set();

  monthlyTrainings.forEach(t => {
    (t.attendees || []).forEach(id => {
      if (activeRosterIds.has(id)) {
        activeParticipants.add(id);
      }
    });
  });

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
    activePlayers: activeParticipants.size, // 👈 activos que participaron
    avgAttendance,
    newPlayers
 };
}

function renderKPIs(kpis) {
  document.getElementById("kpiActivePlayers").textContent =
    kpis.activePlayers;

  document.getElementById("kpiAvgAttendance").textContent =
    kpis.avgAttendance;

  document.getElementById("kpiActivePct").textContent =
    kpis.newPlayers;
}

/* =========================================================
   ALERTAS
========================================================= */

function calculateAlerts({ players, trainings }) {
  const alerts = [];
  const now = new Date();
  const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30;

  // Mapa último entrenamiento por jugador
  const lastAttendance = {};

  trainings.forEach(t => {
    if (!t.active) return;
    const date = new Date(t.date);
    (t.attendees || []).forEach(pid => {
      if (!lastAttendance[pid] || date > lastAttendance[pid]) {
        lastAttendance[pid] = date;
      }
    });
  });

  // Jugadores activos sin entrenar 30 días
  const inactive30 = players.filter(p => {
    if (!p.active) return false;
    const last = lastAttendance[p.id];
    return !last || now - last > THIRTY_DAYS;
  });

  if (inactive30.length) {
    alerts.push(`❌ ${inactive30.length} jugadores activos sin entrenar en 30 días`);
  }

  // Entrenos con pocos handlers
  trainings.forEach(t => {
    if (!t.active) return;
    const handlers = (t.attendees || []).filter(
      id => players.find(p => p.id === id && p.role === "handler")
    );
    if (handlers.length > 0 && handlers.length < 3) {
      alerts.push(`⚠️ ${t.date}: solo ${handlers.length} handlers`);
    }
  });

  return alerts;
}

function renderAlerts(alerts) {
  const el = document.getElementById("alertsList");
  if (!el) return;

  el.innerHTML = alerts.length
    ? alerts.map(a => `<li class="list-group-item">${a}</li>`).join("")
    : `<li class="list-group-item text-muted">Todo en orden 👍</li>`;
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

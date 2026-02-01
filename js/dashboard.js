// dashboard.js
// Dashboard principal: jugadores, entrenamientos, KPIs y alertas

import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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


/* =========================================================
   DASHBOARD LOAD
========================================================= */

async function loadDashboard() {
  // Jugadores
  const playersSnap = await getDocs(collection(db, "club_players"));
  const players = playersSnap.docs.map(doc =>
    Player.fromFirestore(doc)
  );

  // Entrenamientos
  const trainingsSnap = await getDocs(collection(db, "trainings"));
  const trainings = trainingsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Cumpleaños
  renderBirthdays(players);

  // KPIs
  const kpis = calculateMonthlyKPIs({ players, trainings });
  renderKPIs(kpis);

  // Alertas
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
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { month: m - 1, day: d };
}

function renderBirthdays(players) {
  const today = new Date();

  const list = players
    .map(p => {
      const b = parseBirthday(p.birthday);
      return b ? { player: p, ...b } : null;
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
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Entrenamientos activos del mes (por fecha real)
  const monthlyTrainings = trainings.filter(t => {
    if (!t.active || !t.date) return false;
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // Asistencia total
  const totalAttendance = monthlyTrainings.reduce(
    (sum, t) => sum + (t.attendees?.length ?? 0),
    0
  );

  const avgAttendance = monthlyTrainings.length
    ? Math.round(totalAttendance / monthlyTrainings.length)
    : 0;

  // IDs activos en roster
  const activeRosterIds = new Set(
    players.filter(p => p.active).map(p => p.id)
  );

  // Activos que sí participaron
  const activeParticipants = new Set();

  monthlyTrainings.forEach(t => {
    (t.attendees || []).forEach(id => {
      if (activeRosterIds.has(id)) {
        activeParticipants.add(id);
      }
    });
  });

  // Jugadores nuevos del mes
  const newPlayers = players.filter(p => {
    if (!p.createdAt) return false;
    const d = p.createdAt.toDate?.() ?? new Date(p.createdAt);
    return d.getFullYear() === year && d.getMonth() === month;
  }).length;

  return {
    activePlayers: activeParticipants.size,  
    avgAttendance,
    trainingsCount: monthlyTrainings.length
};

}

function renderKPIs(kpis) {
  document.getElementById("kpiActivePlayers").textContent =
    kpis.activePlayers;

  document.getElementById("kpiAvgAttendance").textContent =
    kpis.avgAttendance;

  document.getElementById("kpiTrainingsCount").textContent =
    kpis.trainingsCount;
}

/* =========================================================
   ALERTAS
========================================================= */

function calculateAlerts({ players, trainings }) {
  const alerts = [];
  const now = new Date();
  const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30;

  const lastAttendance = {};

  trainings.forEach(t => {
    if (!t.active || !t.date) return;
    const d = new Date(t.date);
    (t.attendees || []).forEach(pid => {
      if (!lastAttendance[pid] || d > lastAttendance[pid]) {
        lastAttendance[pid] = d;
      }
    });
  });

  // 🔴 Activos sin entrenar 30 días
  const inactive30 = players.filter(p => {
    if (!p.active) return false;
    const last = lastAttendance[p.id];
    return !last || now - last > THIRTY_DAYS;
  });

  if (inactive30.length) {
    alerts.push({
      type: "danger",
      message: `${inactive30.length} jugadores activos sin entrenar en 30 días.`
    });
  }

  // 🟡 Entrenos con pocos handlers
  trainings.forEach(t => {
    if (!t.active) return;

    const handlers = (t.attendees || []).filter(id =>
      players.find(p => p.id === id && p.role === "handler")
    );

    if (handlers.length < 3) {
      alerts.push({
        type: "warning",
        message: `${t.date}: solo ${handlers.length} handlers participaron del entrenamiento.`
      });
    }
  });

  return alerts;
}

function renderAlerts(alerts) {
  const el = document.getElementById("alertsList");
  if (!el) return;

  if (!alerts.length) {
    el.innerHTML = `
      <div class="alert-item">
        <span class="alert-icon">✅</span>
        <div class="alert-text">Todo en orden</div>
      </div>`;
    return;
  }

  el.innerHTML = alerts
    .map(
      a => `
        <div class="alert-item alert-${a.type}">
          <span class="alert-icon">
            ${a.type === "danger" ? "❌" : "⚠️"}
          </span>
          <div class="alert-text">${a.message}</div>
        </div>
      `
    )
    .join("");
}

/* =========================================================
   VERSION
========================================================= */

document.getElementById("appVersion").textContent =
  `v${APP_CONFIG.version}`;

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

function toDateSafe(birthday) {
  if (!birthday) return null;

  // Firestore Timestamp (tiene .toDate())
  if (typeof birthday === "object" && typeof birthday.toDate === "function") {
    const d = birthday.toDate();
    return isNaN(d) ? null : d;
  }

  // JS Date
  if (birthday instanceof Date) {
    return isNaN(birthday) ? null : birthday;
  }

  // String
  if (typeof birthday === "string") {
    const s = birthday.trim().replaceAll("/", "-"); // soporta "YYYY/MM/DD"
    // intento directo
    const d1 = new Date(s);
    if (!isNaN(d1)) return d1;

    // fallback manual "YYYY-MM-DD"
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const da = Number(m[3]);
      const d2 = new Date(y, mo, da);
      return isNaN(d2) ? null : d2;
    }
  }

  return null;
}

function renderBirthdays(players) {
  const birthdaysList = document.getElementById("birthdaysList");
  if (!birthdaysList) return;

  const today = new Date();
  const currentMonth = today.getMonth();

  const list = (players || [])
    .map(p => {
      const d = toDateSafe(p.birthday);
      if (!d) return null;
      return { player: p, month: d.getMonth(), day: d.getDate() };
    })
    .filter(Boolean)
    .filter(x => x.month === currentMonth)
    .sort((a, b) => a.day - b.day);

  if (!list.length) {
    birthdaysList.textContent = "No hay cumpleañeros este mes";
    return;
  }

  birthdaysList.innerHTML = list
    .map(({ player, day }) => {
      const isToday = day === today.getDate();
      return `
        <div class="d-flex justify-content-between align-items-center py-1">
          <div><strong>${escapeHtml(player.fullName)}</strong></div>
          <div class="text-muted">${day}${isToday ? " <span class='badge text-bg-success ms-1'>HOY</span>" : ""}</div>
        </div>
      `;
    })
    .join("");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================================================
   KPIs
========================================================= */

function calculateMonthlyKPIs({ players, trainings }) {
  const now = new Date();
  const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30;
  const since = new Date(now.getTime() - THIRTY_DAYS);

  // Entrenamientos de los últimos 30 días
  const recentTrainings = trainings.filter(t => {
    if (!t.date) return false;
    const d = t.date.toDate?.() ?? new Date(t.date);
    return d >= since && d <= now;
  });

  // Asistencia total
  const totalAttendance = recentTrainings.reduce(
    (sum, t) => sum + (t.attendees?.length ?? 0),
    0
  );

  const avgAttendance = recentTrainings.length
    ? Math.round(totalAttendance / recentTrainings.length)
    : 0;

  // IDs de jugadores activos en roster
  const activeRosterIds = new Set(
    players.filter(p => p.active).map(p => p.id)
  );

  // Jugadores activos que participaron al menos una vez
  const activeParticipants = new Set();

  recentTrainings.forEach(t => {
    (t.attendees || []).forEach(id => {
      if (activeRosterIds.has(id)) {
        activeParticipants.add(id);
      }
    });
  });

  return {
    activePlayers: activeParticipants.size, // activos que entrenaron en últimos 30 días
    avgAttendance,
    trainingsCount: recentTrainings.length
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

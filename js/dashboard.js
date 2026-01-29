import { db } from "./firebase.js";

import { watchAuth, logout } from "./auth.js";


import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { APP_CONFIG } from "./config.js";

import { showLoader, hideLoader } from "./main.js";

const trainingsTable = document.getElementById("trainingsTable");
const playersTable = document.getElementById("playersTable");

const monthFilter = document.getElementById("monthFilter");
const clearFilterBtn = document.getElementById("clearFilter");

const currentMonth = new Date().getMonth(); // 0-11

let allTrainings = {};
let allPlayers = {};
let allAttendance = [];

watchAuth(user => {
  console.log("Usuario autenticado:", user.email);
  loadData(); // SOLO acá
});
document
  .getElementById("logoutBtn")
  .addEventListener("click", logout);
  
/* ================= LOAD DATA ================= */

async function loadData() {
  showLoader();

  try {

    // jugadores
    const playersSnap = await getDocs(collection(db, "club_players"));
    playersSnap.forEach(d => {
      allPlayers[d.id] = {
        name: d.data().name,
        birthday: d.data().birthday || null,
        count: 0
      };
    });

    // entrenos
    const trainingsSnap = await getDocs(collection(db, "club_trainings"));
    trainingsSnap.forEach(d => {
      allTrainings[d.id] = {
        date: d.id,
        count: 0
      };
    });

    // asistencia
    const attendanceSnap = await getDocs(collection(db, "club_attendance"));
    attendanceSnap.forEach(d => {
      allAttendance.push(d.data());
    });

    applyFilter();
  } catch (err) {
    console.error("Error cargando dashboard", err);
  } finally {
    hideLoader();
  }
}

/* ================= FILTER ================= */

function applyFilter() {
  // reset
  const trainings = {};
  const players = {};

  Object.keys(allTrainings).forEach(k => {
    trainings[k] = { ...allTrainings[k], count: 0 };
  });

  Object.keys(allPlayers).forEach(k => {
    players[k] = { ...allPlayers[k], count: 0 };
  });

  const selectedMonth = monthFilter.value; // yyyy-mm

  const filteredTrainings = selectedMonth
    ? Object.values(trainings).filter(t => t.date.startsWith(selectedMonth))
    : Object.values(trainings);

  const validTrainingIds = new Set(filteredTrainings.map(t => t.date));

  allAttendance.forEach(a => {
    if (!validTrainingIds.has(a.trainingId)) return;

    if (trainings[a.trainingId]) {
      trainings[a.trainingId].count++;
    }

    if (players[a.playerId]) {
      players[a.playerId].count++;
    }
  });

  renderTrainings(filteredTrainings);
  renderPlayers(
    Object.values(players),
    filteredTrainings.length
  );
  renderBirthdays(players, selectedMonth);
}

/* ================= RENDER ================= */

function renderTrainings(list) {
  trainingsTable.innerHTML = "";

  list
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach(t => {
      trainingsTable.innerHTML += `
        <tr>
          <td>${t.date}</td>
          <td>${t.count}</td>
        </tr>
      `;
    });
}

function renderPlayers(list, totalTrainings) {
  playersTable.innerHTML = "";

  list
    .sort((a, b) => b.count - a.count)
    .forEach(p => {
      const percent =
        totalTrainings === 0
          ? 0
          : Math.round((p.count / totalTrainings) * 100);

      playersTable.innerHTML += `
        <tr>
          <td>${p.name}</td>
          <td>${p.count}</td>
          <td>${percent}%</td>
        </tr>
      `;
    });
}

/* ================= BIRTHDAY ================= */

const birthdaysList = document.getElementById("birthdaysList");

function parseBirthday(str) {
  if (!str) return null;

  // MM/DD/YYYY
  if (str.includes("/")) {
    const [month, day, year] = str.split("/").map(Number);
    if (!month || !day) return null;
    return { month: month - 1, day };
  }

  // YYYY-MM-DD
  if (str.includes("-")) {
    const d = new Date(str);
    if (isNaN(d)) return null;
    return { month: d.getMonth(), day: d.getDate() };
  }

  return null;
}

function renderBirthdays(playersObj, selectedMonth) {
  if (!birthdaysList) return;

  const month = selectedMonth
    ? parseInt(selectedMonth.split("-")[1], 10) - 1
    : currentMonth;

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth();

  const cumpleaneros = Object.values(playersObj)
    .filter(p => p.birthday)
    .map(p => {
      const parsed = parseBirthday(p.birthday);
      if (!parsed) return null;
      return { ...p, ...parsed };
    })
    .filter(p => p.month === month)
    .sort((a, b) => a.day - b.day);

  if (cumpleaneros.length === 0) {
    birthdaysList.innerHTML = `<p>No hay cumpleañeros este mes 🎈</p>`;
    return;
  }

  birthdaysList.innerHTML = cumpleaneros
    .map(p => {
      const isToday =
        p.day === todayDay && p.month === todayMonth;

      return `
        <div class="birthday-item ${isToday ? "today" : ""}">
          🎂 <strong>${p.name}</strong> — ${p.day}
          ${isToday ? " (HOY 🎉)" : ""}
        </div>
      `;
    })
    .join("");
}


/* ================= EVENTS ================= */

monthFilter.onchange = applyFilter;

clearFilterBtn.onclick = () => {
  monthFilter.value = "";
  applyFilter();
};

/* ================= VERSION ================= */
const versionEl = document.getElementById("appVersion");

if (versionEl) {
  versionEl.textContent = `v${APP_CONFIG.version}`;
}


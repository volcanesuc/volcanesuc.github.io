import { db } from "./firebase.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const trainingsTable = document.getElementById("trainingsTable");
const playersTable = document.getElementById("playersTable");

const monthFilter = document.getElementById("monthFilter");
const clearFilterBtn = document.getElementById("clearFilter");

let allTrainings = {};
let allPlayers = {};
let allAttendance = [];

/* ================= LOAD DATA ================= */

async function loadData() {
  // jugadores
  const playersSnap = await getDocs(collection(db, "club_players"));
  playersSnap.forEach(d => {
    allPlayers[d.id] = {
      name: d.data().name,
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

/* ================= EVENTS ================= */

monthFilter.onchange = applyFilter;

clearFilterBtn.onclick = () => {
  monthFilter.value = "";
  applyFilter();
};

/* ================= INIT ================= */

loadData();

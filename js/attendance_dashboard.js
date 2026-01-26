import { db } from "./firebase.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const trainingsTable = document.getElementById("trainingsTable");
const playersTable = document.getElementById("playersTable");

async function loadDashboard() {
  // 1️⃣ jugadores
  const playersSnap = await getDocs(collection(db, "club_players"));
  const players = {};
  playersSnap.forEach(d => {
    players[d.id] = {
      name: d.data().name,
      count: 0
    };
  });

  // 2️⃣ entrenos
  const trainingsSnap = await getDocs(collection(db, "club_trainings"));
  const trainings = {};
  trainingsSnap.forEach(d => {
    trainings[d.id] = {
      date: d.id,
      count: 0
    };
  });

  const totalTrainings = Object.keys(trainings).length;

  // 3️⃣ asistencia
  const attendanceSnap = await getDocs(collection(db, "club_attendance"));

  attendanceSnap.forEach(d => {
    const { trainingId, playerId } = d.data();

    if (trainings[trainingId]) {
      trainings[trainingId].count++;
    }

    if (players[playerId]) {
      players[playerId].count++;
    }
  });

  renderTrainings(Object.values(trainings));
  renderPlayers(Object.values(players), totalTrainings);
}

/* ========= RENDER ========= */

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

loadDashboard();

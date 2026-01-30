import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "./firebase.js";
import { loadHeader } from "./components/header.js";

/* -------------------------
  INIT
------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  loadHeader("trainings");

  await loadTrainings();
  await loadPlayers();

  document
    .getElementById("saveTrainingBtn")
    .addEventListener("click", saveTraining);

  hideLoading();
});

/* -------------------------
  STATE
------------------------- */
let players = [];
let attendanceMap = {};

/* -------------------------
  LOADERS
------------------------- */
function hideLoading() {
  document.body.classList.remove("loading");
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "none";
}

/* -------------------------
  TRAININGS LIST
------------------------- */
async function loadTrainings() {
  const tbody = document.getElementById("trainingsTable");
  tbody.innerHTML = "";

  const q = query(
    collection(db, "trainings"),
    orderBy("date", "desc")
  );

  const snapshot = await getDocs(q);

  snapshot.forEach(doc => {
    const t = doc.data();
    const count = t.attendance
      ? Object.keys(t.attendance).length
      : 0;

    tbody.innerHTML += `
      <tr>
        <td>${t.date}</td>
        <td>${count}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary" disabled>
            Editar
          </button>
        </td>
      </tr>
    `;
  });
}

/* -------------------------
  PLAYERS
------------------------- */
async function loadPlayers() {
  const tbody = document.getElementById("playersTable");
  tbody.innerHTML = "";

  const snapshot = await getDocs(collection(db, "club_players"));

  players = snapshot.docs
  .map(doc => ({
    id: doc.id,
    firstName: doc.data().firstName,
    lastName: doc.data().lastName,
    number: doc.data().number,
    active: doc.data().active !== false
  }))
  .filter(p => p.active)
  .sort((a, b) =>
    `${a.firstName} ${a.lastName}`
      .localeCompare(`${b.firstName} ${b.lastName}`)
  );

  players.forEach(player => {
    tbody.innerHTML += `
      <tr>
        <td>
          <input
            type="checkbox"
            data-id="${player.id}"
            class="attendance-check"
          />
        </td>
        <td>${player.firstName} ${player.lastName}</td>
        <td>${player.number ?? "-"}</td>
      </tr>
    `;
  });

  document
    .querySelectorAll(".attendance-check")
    .forEach(cb =>
      cb.addEventListener("change", onAttendanceChange)
    );
}

/* -------------------------
  ATTENDANCE
------------------------- */
function onAttendanceChange(e) {
  const playerId = e.target.dataset.id;

  if (e.target.checked) {
    attendanceMap[playerId] = true;
  } else {
    delete attendanceMap[playerId];
  }
}

/* -------------------------
  SAVE TRAINING
------------------------- */
async function saveTraining() {
  const dateInput = document.getElementById("trainingDate");
  const date = dateInput.value;

  if (!date) {
    alert("Selecciona una fecha");
    return;
  }

await addDoc(collection(db, "trainings"), {
  date,
  attendance: attendanceMap,
  attendanceCount: Object.keys(attendanceMap).length,
  createdAt: serverTimestamp()
});

  // reset
  attendanceMap = {};
  dateInput.value = "";
  document.getElementById("attendanceText").value = "";
  document
    .querySelectorAll(".attendance-check")
    .forEach(cb => (cb.checked = false));

  bootstrap.Modal
    .getInstance(document.getElementById("trainingModal"))
    .hide();

  await loadTrainings();
}

const trainingModal = document.getElementById("trainingModal");

trainingModal.addEventListener("show.bs.modal", () => {
  attendanceMap = {};
  document.getElementById("trainingDate").value = "";
  document.getElementById("attendanceText").value = "";
  document
    .querySelectorAll(".attendance-check")
    .forEach(cb => (cb.checked = false));
});


document
  .getElementById("processBtn")
  .addEventListener("click", () => {
    const text = document
      .getElementById("attendanceText")
      .value
      .toLowerCase();

    players.forEach(p => {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      const checkbox = document.querySelector(
        `.attendance-check[data-id="${p.id}"]`
      );

      if (text.includes(p.firstName.toLowerCase()) || text.includes(fullName)) {
        checkbox.checked = true;
        attendanceMap[p.id] = true;
      }
    });
  });



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
import { Training } from "./models/training.js";

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  loadHeader("trainings");

  await loadTrainings();
  await loadPlayers();

  document
    .getElementById("saveTrainingBtn")
    .addEventListener("click", saveTraining);

  document
    .getElementById("processBtn")
    .addEventListener("click", processQuickText);

  hideLoading();
});

/* =========================
   STATE
========================= */
let players = [];
let attendees = [];

/* =========================
   LOADER
========================= */
function hideLoading() {
  document.body.classList.remove("loading");
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "none";
}

/* =========================
   LOAD TRAININGS
========================= */
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
    const count = Array.isArray(t.attendees)
      ? t.attendees.length
      : 0;

    tbody.innerHTML += `
      <tr>
        <td>${t.date}</td>
        <td>${count}</td>
        <td class="small text-muted">
          ${t.summary ?? ""}
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary" disabled>
            Editar
          </button>
        </td>
      </tr>
    `;
  });
}

/* =========================
   LOAD PLAYERS
========================= */
async function loadPlayers() {
  const list = document.getElementById("playersList");
  list.innerHTML = "";

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
    list.innerHTML += `
      <label class="attendance-item">
        <input
          type="checkbox"
          class="attendance-check"
          data-id="${player.id}"
        />
        <span class="attendance-name">
          ${player.firstName} ${player.lastName}
        </span>
        <span class="attendance-number">
          ${player.number ?? ""}
        </span>
      </label>
    `;
  });

  document
    .querySelectorAll(".attendance-check")
    .forEach(cb =>
      cb.addEventListener("change", onAttendanceChange)
    );
}


/* =========================
   ATTENDANCE
========================= */
function onAttendanceChange(e) {
  const playerId = e.target.dataset.id;

  if (e.target.checked) {
    if (!attendees.includes(playerId)) {
      attendees.push(playerId);
    }
  } else {
    attendees = attendees.filter(id => id !== playerId);
  }
}

/* =========================
   QUICK TEXT (WHATSAPP)
========================= */
function processQuickText() {
  const text = document
    .getElementById("attendanceText")
    .value
    .toLowerCase();

  players.forEach(player => {
    const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
    const checkbox = document.querySelector(
      `.attendance-check[data-id="${player.id}"]`
    );

    if (
      text.includes(player.firstName.toLowerCase()) ||
      text.includes(fullName)
    ) {
      checkbox.checked = true;

      if (!attendees.includes(player.id)) {
        attendees.push(player.id);
      }
    }
  });
}

/* =========================
   SAVE TRAINING
========================= */
async function saveTraining() {
  const date = document.getElementById("trainingDate").value;
  const summary = document
    .getElementById("trainingSummary")
    .value
    .trim();

  const notes = document
    .getElementById("trainingNotes")
    .value
    .trim();

  if (!date) {
    alert("Selecciona una fecha");
    return;
  }

  const training = new Training(null, {
    date,
    attendees,
    summary,
    notes,
    createdAt: serverTimestamp()
  });

  await addDoc(
    collection(db, "trainings"),
    training.toFirestore()
  );

  resetModal();
  await loadTrainings();
}

/* =========================
   MODAL RESET
========================= */
const trainingModal = document.getElementById("trainingModal");

trainingModal.addEventListener("show.bs.modal", resetModal);

function resetModal() {
  attendees = [];

  document.getElementById("trainingDate").value = "";
  document.getElementById("attendanceText").value = "";
  document.getElementById("trainingSummary").value = "";
  document.getElementById("trainingNotes").value = "";

  document
    .querySelectorAll(".attendance-check")
    .forEach(cb => (cb.checked = false));
}

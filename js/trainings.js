import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
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
  await loadHeader("trainings");

  await loadPlayers();
  await loadTrainings();

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
let trainings = [];
let currentTrainingId = null;
let editingTrainingId = null;

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
  const cards = document.getElementById("trainingsCards");

  tbody.innerHTML = "";
  cards.innerHTML = "";
  trainings = [];

  const q = query(
    collection(db, "trainings"),
    orderBy("date", "desc")
  );

  const snapshot = await getDocs(q);

  snapshot.forEach(doc => {
    const t = { id: doc.id, ...doc.data() };
    trainings.push(t);

    const count = Array.isArray(t.attendees)
      ? t.attendees.length
      : 0;

    /* DESKTOP ROW */
    tbody.innerHTML += `
      <tr data-id="${t.id}" class="training-row">
        <td>${t.date}</td>
        <td>${t.summary ?? "-"}</td>
        <td>${count}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary edit-training">
            Editar
          </button>
        </td>
      </tr>
    `;

    /* MOBILE CARD */
    cards.innerHTML += `
      <div class="card mb-2 training-card" data-id="${t.id}">
        <div class="card-body p-3">
          <div class="fw-semibold">${t.date}</div>

          <div class="text-muted small">
            ${t.summary ?? "Entrenamiento"}
          </div>

          <div class="d-flex justify-content-between mt-2">
            <span class="small">👥 ${count} asistentes</span>
            <span class="text-primary small">Editar →</span>
          </div>
        </div>
      </div>
    `;
  });

  bindEditEvents();
}

/* =========================
   EDIT EVENTS
========================= */

function bindEditEvents() {
  document
    .querySelectorAll(".edit-training, .training-card")
    .forEach(el => {
      el.onclick = () => {
        const id = el.closest("[data-id]").dataset.id;
        const training = trainings.find(t => t.id === id);
        if (!training) return;

        openEditTraining(training);
      };
    });
}


function openEditTraining(training) {
  currentTrainingId = training.id;

  document.querySelector("#trainingModal .modal-title").innerText =
    "Editar entrenamiento";

  document.getElementById("quickTextSection").style.display = "none";

  trainingDate.value = training.date;
  trainingSummary.value = training.summary ?? "";
  trainingNotes.value = training.notes ?? "";

  attendees = Array.isArray(training.attendees)
    ? [...training.attendees]
    : [];

  document
    .querySelectorAll(".attendance-check")
    .forEach(cb => {
      cb.checked = attendees.includes(cb.dataset.id);
    });

  bootstrap.Modal
    .getOrCreateInstance(trainingModal)
    .show();
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
  const date = trainingDate.value;
  if (!date) {
    alert("Selecciona una fecha");
    return;
  }

  const payload = {
    date,
    attendees,
    summary: trainingSummary.value.trim(),
    notes: trainingNotes.value.trim(),
  };

  if (currentTrainingId) {
    await updateDoc(
      doc(db, "trainings", currentTrainingId),
      payload
    );
  } else {
    payload.createdAt = serverTimestamp();
    await addDoc(
      collection(db, "trainings"),
      payload
    );
  }


  bootstrap.Modal
    .getInstance(trainingModal)
    .hide();

  resetModal();
  await loadTrainings();
}


/* =========================
   MODAL RESET
========================= */
const trainingModal = document.getElementById("trainingModal");

trainingModal.addEventListener("hidden.bs.modal", resetModal);

function resetModal() {
  currentTrainingId = null;
  attendees = [];

  document.querySelector("#trainingModal .modal-title")
    .innerText = "Nuevo entrenamiento";

  document.getElementById("quickTextSection").style.display = "block";

  trainingDate.value = "";
  trainingSummary.value = "";
  trainingNotes.value = "";
  attendanceText.value = "";

  document
    .querySelectorAll(".attendance-check")
    .forEach(cb => (cb.checked = false));
}


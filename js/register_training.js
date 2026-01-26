import { db } from "./firebase.js";

import {
  doc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const tableBody = document.getElementById("playersTable");
const sortNameBtn = document.getElementById("sortName");
const sortNumberBtn = document.getElementById("sortNumber");

let players = [];
let sortState = {
  field: "name",
  asc: true
};

async function loadPlayers() {
  tableBody.innerHTML = `<tr><td colspan="3">Cargando...</td></tr>`;

  const snapshot = await getDocs(collection(db, "club_players"));

  players = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  renderTable();
}

function renderTable() {
  tableBody.innerHTML = "";

  const sorted = [...players].sort((a, b) => {
    let valA = a[sortState.field];
    let valB = b[sortState.field];

    if (sortState.field === "name") {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return sortState.asc ? -1 : 1;
    if (valA > valB) return sortState.asc ? 1 : -1;
    return 0;
  });

  sorted.forEach(p => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>
        <input type="checkbox"
          data-player-id="${p.id}"
          data-player-name="${p.name}">
      </td>
      <td>${p.name}</td>
      <td>${p.number}</td>
    `;

    tableBody.appendChild(tr);
  });
}

// 🔁 Sorting
sortNameBtn.onclick = () => toggleSort("name");
sortNumberBtn.onclick = () => toggleSort("number");

function toggleSort(field) {
  if (sortState.field === field) {
    sortState.asc = !sortState.asc;
  } else {
    sortState.field = field;
    sortState.asc = true;
  }
  renderTable();
}

const attendanceText = document.getElementById("attendanceText");
const processBtn = document.getElementById("processBtn");

// 🔤 helpers
function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

processBtn.onclick = () => {
  const raw = attendanceText.value;
  if (!raw) return;

  const tokens = normalize(raw)
    .split(/\s+|\n|,/)
    .filter(t => t.length >= 3); // evita ruido tipo "de"

  // recorrer jugadores visibles
  document
    .querySelectorAll("input[type=checkbox][data-player-name]")
    .forEach(cb => {
      const playerName = normalize(cb.dataset.playerName);

      const match = tokens.some(token =>
        playerName.includes(token) || token.includes(playerName)
      );

      if (match) cb.checked = true;
    });
};


const saveBtn = document.getElementById("saveBtn");
const trainingDateInput = document.getElementById("trainingDate");

saveBtn.onclick = async () => {
  const date = trainingDateInput.value;

  if (!date) {
    alert("Elegí una fecha");
    return;
  }

  saveBtn.disabled = true;
  saveBtn.innerText = "Guardando...";

  try {
    /* 1️⃣ crear o reutilizar entreno (1 por fecha) */
    const trainingRef = doc(db, "club_trainings", date);

    await setDoc(
      trainingRef,
      {
        date,
        createdAt: serverTimestamp()
      },
      { merge: true }
    );

    /* 2️⃣ borrar asistencia previa de ese entreno (si existe) */
    const existing = await getDocs(
      query(
        collection(db, "club_attendance"),
        where("trainingId", "==", date)
      )
    );

    for (const d of existing.docs) {
      await d.ref.delete();
    }

    /* 3️⃣ guardar presentes */
    const checkboxes = document.querySelectorAll(
      "input[type=checkbox][data-player-id]"
    );

    let count = 0;

    for (const cb of checkboxes) {
      if (!cb.checked) continue;

      await addDoc(collection(db, "club_attendance"), {
        trainingId: date,
        playerId: cb.dataset.playerId,
        present: true
      });

      count++;
    }

    alert(`Entreno guardado ✅ (${count} presentes)`);

  } catch (err) {
    console.error(err);
    alert("❌ Error guardando entreno");
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = "Guardar entreno";
  }
};


// 🚀 init
loadPlayers();

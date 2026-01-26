import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  Timestamp
} from "firebase/firestore";

let playersState = [];

function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function loadPlayers() {
  const snap = await getDocs(collection(db, "club_players"));

  playersState = snap.docs
    .map(d => ({
      id: d.id,
      ...d.data(),
      present: false
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  renderPlayerList();
}

function renderPlayerList() {
  const container = document.getElementById("playersList");
  container.innerHTML = "";

  playersState.forEach((p, index) => {
    const label = document.createElement("label");
    label.style.display = "block";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = p.present;

    checkbox.addEventListener("change", e => {
      playersState[index].present = e.target.checked;
    });

    label.appendChild(checkbox);
    label.append(` ${p.name}`);
    container.appendChild(label);
  });
}

function parseNames(text) {
  return text
    .split(/\n|,/)
    .map(n => normalize(n))
    .filter(n => n.length > 2);
}

function applyTextAttendance(text) {
  const names = parseNames(text);

  playersState = playersState.map(p => ({
    ...p,
    present: names.includes(p.normalized)
  }));

  renderPlayerList();
}

document
  .getElementById("processBtn")
  .addEventListener("click", () => {
    const text = document.getElementById("attendanceText").value;
    applyTextAttendance(text);
  });

document
  .getElementById("saveBtn")
  .addEventListener("click", saveTraining);

  async function saveTraining() {
  const trainingRef = await addDoc(collection(db, "club_trainings"), {
    date: new Date().toISOString().slice(0, 10),
    createdAt: Timestamp.now()
  });

  const writes = [];

  playersState.forEach(p => {
    if (p.present) {
      writes.push(
        addDoc(collection(db, "club_attendance"), {
          trainingId: trainingRef.id,
          playerId: p.id,
          status: "present"
        })
      );
    }
  });

  await Promise.all(writes);
  alert("Entreno guardado ✅");
}

loadPlayers();

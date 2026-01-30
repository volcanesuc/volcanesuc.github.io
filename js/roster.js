import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { loadHeader } from "./components/header.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { Player } from "./models/player.js";

loadHeader("roster");

document.getElementById("logoutBtn")?.addEventListener("click", logout);


const table = document.getElementById("playersTable");
const modal = new bootstrap.Modal("#playerModal");

const form = document.getElementById("playerForm");

const fields = {
  id: document.getElementById("playerId"),
  firstName: document.getElementById("firstName"),
  lastName: document.getElementById("lastName"),
  number: document.getElementById("number"),
  gender: document.getElementById("gender"),
  birthday: document.getElementById("birthday"),
  role: document.getElementById("role"),
  active: document.getElementById("active")
};

let players = {};

async function loadPlayers() {
  players = {};
  const snap = await getDocs(collection(db, "club_players"));
  snap.forEach(d => {
    const player = Player.fromFirestore(d);
    players[player.id] = player;
  });

  render();
}


function render() {
  table.innerHTML = Object.values(players)
    .sort((a, b) => a.lastName.localeCompare(b.lastName))
    .map(
      p => `
      <tr data-id="${p.id}" class="player-row" style="cursor:pointer">
        <td class="fw-semibold">${p.fullName}</td>
        <td><span class="badge bg-info text-dark">${p.roleLabel}</span>
        </td>
        <td>${p.number ?? "—"}</td>
        <td>${p.gender ?? "—"}</td>
        <td>${p.birthday ?? "—"}</td>
        <td><span class="badge ${p.active ? "bg-success" : "bg-secondary"}"> ${p.active ? "Activo" : "Inactivo"}</span></td>
      </tr>
    `
    )
    .join("");
}

table.onclick = e => {
  const row = e.target.closest(".player-row");
  if (!row) return;

  const id = row.dataset.id;
  const p = players[id];

  fields.id.value = id;
  fields.firstName.value = p.firstName;
  fields.lastName.value = p.lastName;
  fields.number.value = p.number ?? "";
  fields.gender.value = p.gender ?? "";
  fields.birthday.value = p.birthday ?? "";
  fields.active.checked = p.active;
  fields.role.value = p.role ?? "cutter";

  modal.show();
};

document.getElementById("addPlayerBtn").onclick = () => {
  form.reset();
  fields.id.value = "";
  fields.active.checked = true;
  modal.show();
};

form.onsubmit = async e => {
  e.preventDefault();

  const data = {
    firstName: fields.firstName.value.trim(),
    lastName: fields.lastName.value.trim(),
    number: Number(fields.number.value) || null,
    gender: fields.gender.value || null,
    birthday: fields.birthday.value || null,
    role: fields.role.value,
    active: fields.active.checked
  };

    if (fields.id.value) {
        await updateDoc(
            doc(db, "club_players", fields.id.value),
            new Player(null, data).toFirestore()
        );
        } else {
        await setDoc(
            doc(collection(db, "club_players")),
            new Player(null, data).toFirestore()
        );
    }

  modal.hide();
  loadPlayers();
};

watchAuth(async () => {
  showLoader();
  try {
    await loadPlayers();
  } finally {
    hideLoader();
  }
});
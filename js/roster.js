import { db } from "./firebase.js";
import { collection, getDocs, doc, setDoc, updateDoc } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { loadHeader } from "./components/header.js";

loadHeader("roster");

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
  active: document.getElementById("active")
};

let players = {};

async function loadPlayers() {
  const snap = await getDocs(collection(db, "club_players"));
  players = {};

  snap.forEach(d => players[d.id] = d.data());
  render();
}

function render() {
  table.innerHTML = Object.entries(players)
    .sort(([, a], [, b]) => {
      const lastA = (a.lastName || "").toLowerCase();
      const lastB = (b.lastName || "").toLowerCase();
      return lastA.localeCompare(lastB);
    })
    .map(([id, p]) => `
      <tr data-id="${id}" class="player-row" style="cursor:pointer">
        <td>
          <div class="fw-semibold">
            ${p.firstName || "—"} ${p.lastName || ""}
          </div>
        </td>
        <td>${p.number ?? "—"}</td>
        <td>${p.gender ?? "—"}</td>
        <td>${p.birthday ?? "—"}</td>
        <td>
          <span class="badge ${p.active ? "bg-success" : "bg-secondary"}">
            ${p.active ? "Activo" : "Inactivo"}
          </span>
        </td>
      </tr>
    `)
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
    active: fields.active.checked
  };

  if (fields.id.value) {
    await updateDoc(doc(db, "club_players", fields.id.value), data);
  } else {
    await setDoc(doc(collection(db, "club_players")), data);
  }

  modal.hide();
  loadPlayers();
};

loadPlayers();
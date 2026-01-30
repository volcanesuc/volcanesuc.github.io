/*************************************************
 * IMPORTS
 *************************************************/
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

/*************************************************
 * INIT
 *************************************************/

// Header del dashboard
loadHeader("roster");

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", logout);

// DOM
const table = document.getElementById("playersTable");
const modal = new bootstrap.Modal("#playerModal");
const form = document.getElementById("playerForm");

// Campos del formulario
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

// Array plano de jugadores (clave para sorting)
let players = [];

/*************************************************
 * SORT STATE
 *************************************************/

let currentSort = {
  key: "name",
  direction: "asc"
};

/*************************************************
 * LOAD DATA
 *************************************************/

async function loadPlayers() {
  const snap = await getDocs(collection(db, "club_players"));

  players = snap.docs.map(d =>
    Player.fromFirestore(d)
  );

  applySort();
  render();
  updateSortIndicators();
}

/*************************************************
 * SORTING
 *************************************************/

function applySort() {
  const dir = currentSort.direction === "asc" ? 1 : -1;

  players.sort((a, b) => {
    // 1️⃣ PRIORIDAD ABSOLUTA: activos primero
    if (a.active !== b.active) {
      return a.active ? -1 : 1;
    }

    // 2️⃣ Si ambos son activos o ambos inactivos → aplicar sort normal
    let valA, valB;

    switch (currentSort.key) {
      case "name":
        valA = `${a.lastName} ${a.firstName}`.toLowerCase();
        valB = `${b.lastName} ${b.firstName}`.toLowerCase();
        break;

      case "number":
        valA = a.number ?? 999;
        valB = b.number ?? 999;
        break;

      case "role":
        valA = a.role ?? "";
        valB = b.role ?? "";
        break;

      case "gender":
        valA = a.gender ?? "";
        valB = b.gender ?? "";
        break;

      case "birthday":
        valA = a.birthday ?? "";
        valB = b.birthday ?? "";
        break;

      case "active":
        // si clickean "Estado", igual se mantiene la regla
        valA = a.active ? 1 : 0;
        valB = b.active ? 1 : 0;
        break;

      default:
        return 0;
    }

    return valA > valB ? dir : valA < valB ? -dir : 0;
  });
}


/*************************************************
 * RENDER
 *************************************************/

function render() {
  table.innerHTML = players
    .map(
      p => `
      <tr data-id="${p.id}" class="player-row" style="cursor:pointer">
        <td class="fw-semibold">${p.fullName}</td>
        <td>
          <span class="badge bg-info text-dark">
            ${p.roleLabel}
          </span>
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
    `
    )
    .join("");
}

/*************************************************
 * CLICK EN FILA (EDITAR)
 *************************************************/

table.onclick = e => {
  const row = e.target.closest(".player-row");
  if (!row) return;

  const id = row.dataset.id;
  const p = players.find(pl => pl.id === id);
  if (!p) return;

  fields.id.value = p.id;
  fields.firstName.value = p.firstName;
  fields.lastName.value = p.lastName;
  fields.number.value = p.number ?? "";
  fields.gender.value = p.gender ?? "";
  fields.birthday.value = p.birthday ?? "";
  fields.role.value = p.role ?? "cutter";
  fields.active.checked = p.active;

  modal.show();
};

/*************************************************
 * CLICK EN HEADERS (SORT)
 *************************************************/

document.querySelectorAll("th.sortable").forEach(th => {
  th.addEventListener("click", () => {
    const key = th.dataset.sort;

    if (currentSort.key === key) {
      currentSort.direction =
        currentSort.direction === "asc" ? "desc" : "asc";
    } else {
      currentSort.key = key;
      currentSort.direction = "asc";
    }

    applySort();
    render();
    updateSortIndicators();
  });
});

function updateSortIndicators() {
  document.querySelectorAll("th.sortable").forEach(th => {
    th.classList.remove("sorted-asc", "sorted-desc");

    if (th.dataset.sort === currentSort.key) {
      th.classList.add(
        currentSort.direction === "asc"
          ? "sorted-asc"
          : "sorted-desc"
      );
    }
  });
}

/*************************************************
 * NUEVO JUGADOR
 *************************************************/

document.getElementById("addPlayerBtn").onclick = () => {
  form.reset();
  fields.id.value = "";
  fields.active.checked = true;
  modal.show();
};

/*************************************************
 * SAVE FORM
 *************************************************/

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

/*************************************************
 * AUTH FLOW
 *************************************************/

watchAuth(async () => {
  showLoader();
  try {
    await loadPlayers();
  } finally {
    hideLoader();
  }
});

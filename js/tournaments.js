// tournaments.js
import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { loadHeader } from "./components/header.js";

loadHeader("tournaments");

document.getElementById("logoutBtn")?.addEventListener("click", logout);

/* ==========================
   DOM
========================== */
const tableEl = document.getElementById("tournamentsTable");
const cardsEl = document.getElementById("tournamentsCards");
const searchEl = document.getElementById("tournamentSearch");
const addBtn = document.getElementById("addTournamentBtn");

const modalEl = document.getElementById("tournamentModal");
const modal = modalEl ? new bootstrap.Modal(modalEl) : null;

const form = document.getElementById("tournamentForm");
const deleteBtn = document.getElementById("deleteTournamentBtn");

const f = {
  id: document.getElementById("tournamentId"),
  name: document.getElementById("tournamentName"),
  dateStart: document.getElementById("dateStart"),
  dateEnd: document.getElementById("dateEnd"),
  type: document.getElementById("type"),
  age: document.getElementById("age"),
  venue: document.getElementById("venue"),
  location: document.getElementById("location"),
  teamFee: document.getElementById("teamFee"),
  playerFee: document.getElementById("playerFee"),
  notes: document.getElementById("notes"),
  confirmed: document.getElementById("confirmed"),
  title: document.getElementById("tournamentModalTitle")
};

let allTournaments = [];

/* ==========================
   INIT
========================== */
watchAuth(async () => {
  showLoader();
  try {
    await loadTournaments();
    render();
  } catch (e) {
    console.error(e);
  } finally {
    hideLoader();
  }
});

document.getElementById("appVersion").textContent = `v${APP_CONFIG.version}`;

/* ==========================
   LOAD
========================== */
async function loadTournaments() {
  const snap = await getDocs(collection(db, "tournaments"));
  allTournaments = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
}

/* ==========================
   RENDER
========================== */
function render() {
  const q = (searchEl?.value || "").trim().toLowerCase();

  const list = q
    ? allTournaments.filter(t =>
        `${t.name || ""} ${t.location || ""}`.toLowerCase().includes(q)
      )
    : allTournaments;

  renderTable(list);
  renderCards(list);
}

function renderTable(list) {
  if (!tableEl) return;

  tableEl.innerHTML = list.length
    ? list.map(t => {
        const fees = formatFees(t.teamFee, t.playerFee);
        return `
          <tr>
            <td class="fw-bold">${escapeHtml(t.name)}</td>
            <td>${formatDateRange(t.dateStart, t.dateEnd)}</td>
            <td>${badge(t.type)}</td>
            <td>${badge(t.age)}</td>
            <td>${badge(t.venue)}</td>
            <td>${fees}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-primary" data-edit="${t.id}">Editar</button>
            </td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="7" class="text-muted p-3">No hay torneos todavía.</td></tr>`;

  tableEl.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openEdit(btn.getAttribute("data-edit")));
  });
}

function renderCards(list) {
  if (!cardsEl) return;

  cardsEl.innerHTML = list.length
    ? list.map(t => {
        const fees = formatFees(t.teamFee, t.playerFee);
        return `
          <div class="mobile-card mb-3">
            <div class="mobile-card__title">${escapeHtml(t.name)}</div>
            <div class="mobile-card__sub">${formatDateRange(t.dateStart, t.dateEnd)} · ${escapeHtml(t.location || "—")}</div>

            <div class="d-flex flex-wrap gap-2 mt-2">
              <span class="pill">${t.type || "—"}</span>
              <span class="pill">${t.age || "—"}</span>
              <span class="pill">${t.venue || "—"}</span>
            </div>

            <div class="d-flex justify-content-between align-items-center mt-3">
              <div class="text-muted small">${fees}</div>
              <button class="btn btn-sm btn-outline-primary" data-edit="${t.id}">Editar</button>
            </div>
          </div>
        `;
      }).join("")
    : `<div class="text-muted p-2">No hay torneos todavía.</div>`;

  cardsEl.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openEdit(btn.getAttribute("data-edit")));
  });
}

/* ==========================
   MODAL
========================== */
addBtn?.addEventListener("click", () => openNew());
searchEl?.addEventListener("input", render);

function openNew() {
  clearForm();
  f.title.textContent = "Nuevo torneo";
  deleteBtn.style.display = "none";
  modal?.show();
}

function openEdit(id) {
  const t = allTournaments.find(x => x.id === id);
  if (!t) return;

  f.id.value = t.id;
  f.name.value = t.name || "";
  f.dateStart.value = t.dateStart || "";
  f.dateEnd.value = t.dateEnd || "";
  f.type.value = t.type || "mixto";
  f.age.value = t.age || "open";
  f.venue.value = t.venue || "outdoor";
  f.location.value = t.location || "";
  f.teamFee.value = t.teamFee ?? "";
  f.playerFee.value = t.playerFee ?? "";
  f.notes.value = t.notes || "";
  f.confirmed.checked = !!t.confirmed;

  f.title.textContent = "Editar torneo";
  deleteBtn.style.display = "inline-block";
  modal?.show();
}

function clearForm() {
  f.id.value = "";
  f.name.value = "";
  f.dateStart.value = "";
  f.dateEnd.value = "";
  f.type.value = "mixto";
  f.age.value = "open";
  f.venue.value = "outdoor";
  f.location.value = "";
  f.teamFee.value = "";
  f.playerFee.value = "";
  f.notes.value = "";
  f.confirmed.checked = false;
}

/* ==========================
   SAVE / DELETE
========================== */
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showLoader();

  try {
    const payload = {
      name: f.name.value.trim(),
      dateStart: f.dateStart.value,
      dateEnd: f.dateEnd.value || "",
      type: f.type.value,
      age: f.age.value,
      venue: f.venue.value,
      location: f.location.value.trim(),
      teamFee: toNumberOrNull(f.teamFee.value),
      playerFee: toNumberOrNull(f.playerFee.value),
      notes: f.notes.value.trim(),
      confirmed: !!f.confirmed.checked,
      updatedAt: serverTimestamp()
    };

    if (!payload.name || !payload.dateStart) {
      alert("Faltan campos obligatorios: nombre y fecha inicio.");
      return;
    }

    if (f.id.value) {
      await setDoc(doc(db, "tournaments", f.id.value), payload, { merge: true });
    } else {
      await addDoc(collection(db, "tournaments"), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    await loadTournaments();
    render();
    modal?.hide();
  } catch (err) {
    console.error(err);
    alert("Error guardando torneo. Revisa consola.");
  } finally {
    hideLoader();
  }
});

deleteBtn?.addEventListener("click", async () => {
  const id = f.id.value;
  if (!id) return;

  const ok = confirm("¿Eliminar este torneo? Esto no se puede deshacer.");
  if (!ok) return;

  showLoader();
  try {
    await deleteDoc(doc(db, "tournaments", id));
    await loadTournaments();
    render();
    modal?.hide();
  } catch (e) {
    console.error(e);
    alert("Error eliminando torneo. Revisa consola.");
  } finally {
    hideLoader();
  }
});

/* ==========================
   HELPERS
========================== */
function toNumberOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatDateRange(start, end) {
  if (!start) return "—";
  if (!end) return start;
  return `${start} → ${end}`;
}

function formatFees(teamFee, playerFee) {
  const tf = teamFee != null ? `Team ₡${Number(teamFee).toLocaleString("es-CR")}` : null;
  const pf = playerFee != null ? `Player ₡${Number(playerFee).toLocaleString("es-CR")}` : null;
  if (tf && pf) return `${tf} · ${pf}`;
  return tf || pf || "—";
}

function badge(txt) {
  return `<span class="pill">${escapeHtml(txt || "—")}</span>`;
}

// minimal escape para evitar html raro
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

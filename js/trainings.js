// /js/trainings.js
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "./auth/firebase.js";
import { guardPage } from "./page-guard.js";
import { loadHeader } from "./components/header.js";

/* =========================
   CONFIG / COLS
========================= */
const clubId = "volcanes"; // ✅ si luego querés, lo sacamos de CLUB_DATA
const COL_TRAININGS = "trainings";
const COL_PLAYERS = "club_players";
const COL_DRILLS = "drills";
const COL_PLAYBOOK_TRAININGS = "playbook_trainings";

/* =========================
   STATE
========================= */
let players = [];
let attendees = [];
let trainings = [];
let currentTrainingId = null;

// playbook data
let pbDrills = [];
let pbTrainings = [];
let selectedDrillIds = [];
let selectedPlaybookTrainingIds = [];

/* =========================
   DOM
========================= */
const $ = {
  table: document.getElementById("trainingsTable"),
  cards: document.getElementById("trainingsCards"),

  modal: document.getElementById("trainingModal"),
  modalTitle: document.querySelector("#trainingModal .modal-title"),

  trainingDate: document.getElementById("trainingDate"),
  summary: document.getElementById("trainingSummary"),
  notes: document.getElementById("trainingNotes"),

  quickTextSection: document.getElementById("quickTextSection"),
  attendanceText: document.getElementById("attendanceText"),
  processBtn: document.getElementById("processBtn"),

  playersList: document.getElementById("playersList"),
  saveBtn: document.getElementById("saveTrainingBtn"),

  loadingOverlay: document.getElementById("loadingOverlay"),
};

let modalInstance = null;

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  const { cfg, redirected } = await guardPage("trainings");
  if (!redirected) await loadHeader("trainings", cfg);

  ensurePlaybookUI(); // ✅ crea los selectores dentro del modal (sin tocar tu HTML)

  await loadPlayers();
  await loadPlaybookData();
  await loadTrainings();

  bindEvents();

  hideLoading();
});

/* =========================
   LOADER
========================= */
function hideLoading() {
  document.body.classList.remove("loading");
  if ($.loadingOverlay) $.loadingOverlay.style.display = "none";
}
function showLoading() {
  document.body.classList.add("loading");
  if ($.loadingOverlay) $.loadingOverlay.style.display = "flex";
}

/* =========================
   PLAYBOOK UI (inject into modal)
========================= */
function ensurePlaybookUI() {
  // Insertamos una sección Playbook ANTES del bloque "Resumen del entrenamiento"
  // Tu HTML no tiene esos nodos, así que lo armamos acá.

  const summaryEl = document.getElementById("trainingSummary");
  if (!summaryEl) return;

  const summaryBlock = summaryEl.closest(".mb-3");
  if (!summaryBlock) return;

  // evitar duplicar si se recarga el módulo
  if (document.getElementById("pbTrainingsList")) return;

  const wrap = document.createElement("div");
  wrap.className = "mb-3";
  wrap.innerHTML = `
    <label class="form-label fw-semibold">Playbook (opcional)</label>

    <div class="row g-3">
      <div class="col-12 col-lg-6">
        <div class="d-flex justify-content-between align-items-center gap-2">
          <div class="small text-muted">Entrenamientos completos</div>
          <input id="pbTrainingSearch" class="form-control form-control-sm" style="max-width:220px" placeholder="Buscar..." />
        </div>
        <div id="pbTrainingsList" class="list-group mt-2"></div>
      </div>

      <div class="col-12 col-lg-6">
        <div class="d-flex justify-content-between align-items-center gap-2">
          <div class="small text-muted">Drills</div>
          <input id="pbDrillSearch" class="form-control form-control-sm" style="max-width:220px" placeholder="Buscar..." />
        </div>
        <div id="pbDrillsList" class="list-group mt-2"></div>
      </div>
    </div>

    <div class="form-text mt-2">
      Seleccioná drills / entrenos del playbook, o describí todo en el resumen.
    </div>
  `;

  summaryBlock.parentNode.insertBefore(wrap, summaryBlock);

  // binds search (una sola vez)
  const tSearch = document.getElementById("pbTrainingSearch");
  const dSearch = document.getElementById("pbDrillSearch");
  tSearch?.addEventListener("input", renderPlaybookSelectors);
  dSearch?.addEventListener("input", renderPlaybookSelectors);
}

/* =========================
   LOAD PLAYERS
========================= */
async function loadPlayers() {
  const list = $.playersList;
  if (!list) return;

  list.innerHTML = "";

  const snapshot = await getDocs(collection(db, COL_PLAYERS));

  players = snapshot.docs
    .map(d => ({
      id: d.id,
      firstName: d.data().firstName,
      lastName: d.data().lastName,
      number: d.data().number,
      active: d.data().active !== false,
    }))
    .filter(p => p.active)
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  for (const p of players) {
    const label = document.createElement("label");
    label.className = "attendance-item";
    label.innerHTML = `
      <input type="checkbox" class="attendance-check" data-id="${escapeHtml(p.id)}" />
      <span class="attendance-name">${escapeHtml(p.firstName)} ${escapeHtml(p.lastName)}</span>
      <span class="attendance-number">${escapeHtml(p.number ?? "")}</span>
    `;
    list.appendChild(label);
  }

  document.querySelectorAll(".attendance-check").forEach(cb => {
    cb.addEventListener("change", onAttendanceChange);
  });
}

/* =========================
   LOAD PLAYBOOK (drills + playbook trainings)
========================= */
async function loadPlaybookData() {
  // drills activos
  const qDrills = query(
    collection(db, COL_DRILLS),
    where("clubId", "==", clubId),
    where("isActive", "==", true)
  );
  const s1 = await getDocs(qDrills);
  pbDrills = s1.docs.map(d => ({ id: d.id, ...d.data() }));
  pbDrills.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  // playbook trainings (con clubId)
  const qPB = query(
    collection(db, COL_PLAYBOOK_TRAININGS),
    where("clubId", "==", clubId)
  );
  const s2 = await getDocs(qPB);
  pbTrainings = s2.docs.map(d => ({ id: d.id, ...d.data() }));

  // ✅ fallback migración: si no hay nada, traé todos y quedate con los que
  // tienen clubId==clubId o no tienen clubId (docs viejos)
  if (!pbTrainings.length) {
    console.warn("[trainings] 0 playbook_trainings con clubId, intentando fallback (migración).");
    const all = await getDocs(collection(db, COL_PLAYBOOK_TRAININGS));
    pbTrainings = all.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(x => !x.clubId || x.clubId === clubId);
  }

  pbTrainings.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

/* =========================
   LOAD TRAININGS (list)
========================= */
async function loadTrainings() {
  if (!$.table || !$.cards) return;

  $.table.innerHTML = "";
  $.cards.innerHTML = "";
  trainings = [];

  const qy = query(collection(db, COL_TRAININGS), where("clubId", "==", clubId), orderBy("date", "desc"));
  const snapshot = await getDocs(qy);
  snapshot.forEach(d => trainings.push({ id: d.id, ...d.data() }));

  const total = trainings.length;

  trainings.forEach((t, idx) => {
    const count = Array.isArray(t.attendees) ? t.attendees.length : 0;
    const active = t.active !== false;

    const label = trainingLabel(t, idx, total);
    const details = shortTitle(trainingDisplayText(t)); // lo que hicimos antes (summary o lista drills)

    // DESKTOP ROW
    $.table.innerHTML += `
      <tr data-id="${escapeHtml(t.id)}" class="training-row" style="cursor:pointer">
        <td>${escapeHtml(label)}</td>
        <td>${escapeHtml(details)}</td>
        <td>${count}</td>
        <td>${active ? "✅ Activo" : "📦 Archivado"}</td>
      </tr>
    `;

    // MOBILE CARD
    $.cards.innerHTML += `
      <div class="card mb-2 training-card" data-id="${escapeHtml(t.id)}" style="cursor:pointer">
        <div class="card-body p-3">
          <div class="fw-semibold">${escapeHtml(label)}</div>
          <div class="text-muted small">${escapeHtml(details || "Entrenamiento")}</div>
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

function bindEditEvents() {
  document.querySelectorAll(".training-row, .training-card").forEach(el => {
    el.onclick = () => {
      const id = el.dataset.id;
      const training = trainings.find(t => t.id === id);
      if (!training) return;
      openEditTraining(training);
    };
  });
}

/* =========================
   MODAL: open/edit/reset
========================= */
function openNewTraining() {
  currentTrainingId = null;

  if ($.modalTitle) $.modalTitle.innerText = "Nuevo entrenamiento";
  $.quickTextSection && ($.quickTextSection.style.display = "block");

  // reset state
  attendees = [];
  selectedDrillIds = [];
  selectedPlaybookTrainingIds = [];

  // clear fields
  if ($.trainingDate) $.trainingDate.value = "";
  if ($.summary) $.summary.value = "";
  if ($.notes) $.notes.value = "";
  if ($.attendanceText) $.attendanceText.value = "";

  // uncheck all
  document.querySelectorAll(".attendance-check").forEach(cb => (cb.checked = false));

  // clear searches
  const tSearch = document.getElementById("pbTrainingSearch");
  const dSearch = document.getElementById("pbDrillSearch");
  if (tSearch) tSearch.value = "";
  if (dSearch) dSearch.value = "";

  renderPlaybookSelectors();

  showModal();
}

function openEditTraining(training) {
  currentTrainingId = training.id;

  if ($.modalTitle) $.modalTitle.innerText = "Editar entrenamiento";
  $.quickTextSection && ($.quickTextSection.style.display = "none");

  // fields
  if ($.trainingDate) $.trainingDate.value = training.date ?? "";
  if ($.summary) $.summary.value = training.summary ?? "";
  if ($.notes) $.notes.value = training.notes ?? "";
  if ($.attendanceText) $.attendanceText.value = "";

  attendees = Array.isArray(training.attendees) ? [...training.attendees] : [];

  // ✅ nuevas selecciones
  selectedDrillIds = Array.isArray(training.drillIds) ? [...training.drillIds] : [];
  selectedPlaybookTrainingIds = Array.isArray(training.playbookTrainingIds) ? [...training.playbookTrainingIds] : [];

  // checkboxes de asistencia
  document.querySelectorAll(".attendance-check").forEach(cb => {
    cb.checked = attendees.includes(cb.dataset.id);
  });

  // clear searches
  const tSearch = document.getElementById("pbTrainingSearch");
  const dSearch = document.getElementById("pbDrillSearch");
  if (tSearch) tSearch.value = "";
  if (dSearch) dSearch.value = "";

  renderPlaybookSelectors();

  showModal();
}

function showModal() {
  if (!$.modal) return;
  modalInstance = bootstrap.Modal.getOrCreateInstance($.modal);
  modalInstance.show();
}

function resetModal() {
  // si cerraron el modal, lo dejamos listo para "nuevo"
  openNewTraining(); // abre modal, NO queremos eso
  // entonces re-hacemos un reset "silencioso"
  currentTrainingId = null;
  attendees = [];
  selectedDrillIds = [];
  selectedPlaybookTrainingIds = [];

  if ($.modalTitle) $.modalTitle.innerText = "Nuevo entrenamiento";
  $.quickTextSection && ($.quickTextSection.style.display = "block");

  if ($.trainingDate) $.trainingDate.value = "";
  if ($.summary) $.summary.value = "";
  if ($.notes) $.notes.value = "";
  if ($.attendanceText) $.attendanceText.value = "";

  document.querySelectorAll(".attendance-check").forEach(cb => (cb.checked = false));

  const tSearch = document.getElementById("pbTrainingSearch");
  const dSearch = document.getElementById("pbDrillSearch");
  if (tSearch) tSearch.value = "";
  if (dSearch) dSearch.value = "";

  renderPlaybookSelectors();
}

/* =========================
   PLAYBOOK SELECTORS (render)
========================= */
function renderPlaybookSelectors() {
  const mountT = document.getElementById("pbTrainingsList");
  const mountD = document.getElementById("pbDrillsList");
  if (!mountT || !mountD) return;

  const tTerm = norm(document.getElementById("pbTrainingSearch")?.value);
  const dTerm = norm(document.getElementById("pbDrillSearch")?.value);

  const tFiltered = tTerm ? pbTrainings.filter(x => norm(x.name).includes(tTerm)) : pbTrainings;
  const dFiltered = dTerm ? pbDrills.filter(x => (norm(x.name) + " " + norm(x.authorName)).includes(dTerm)) : pbDrills;

  mountT.innerHTML = "";
  mountD.innerHTML = "";

  for (const t of tFiltered) {
    const checked = selectedPlaybookTrainingIds.includes(t.id);
    const el = document.createElement("label");
    el.className = "list-group-item d-flex gap-2 align-items-start";
    el.innerHTML = `
      <input class="form-check-input mt-1" type="checkbox" ${checked ? "checked" : ""}>
      <div>
        <div class="fw-semibold">${escapeHtml(t.name || "—")}</div>
      </div>
    `;
    el.querySelector("input").addEventListener("change", () => {
      toggleId(selectedPlaybookTrainingIds, t.id);
    });
    mountT.appendChild(el);
  }

  for (const d of dFiltered) {
    const checked = selectedDrillIds.includes(d.id);
    const el = document.createElement("label");
    el.className = "list-group-item d-flex gap-2 align-items-start";
    el.innerHTML = `
      <input class="form-check-input mt-1" type="checkbox" ${checked ? "checked" : ""}>
      <div>
        <div class="fw-semibold">${escapeHtml(d.name || "—")}</div>
        <div class="text-muted small">${escapeHtml(d.objective || "—")}</div>
      </div>
    `;
    el.querySelector("input").addEventListener("change", () => {
      toggleId(selectedDrillIds, d.id);
    });
    mountD.appendChild(el);
  }
}

function toggleId(arr, id) {
  const i = arr.indexOf(id);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(id);
}

/* =========================
   ATTENDANCE
========================= */
function onAttendanceChange(e) {
  const playerId = e.target.dataset.id;
  if (e.target.checked) {
    if (!attendees.includes(playerId)) attendees.push(playerId);
  } else {
    attendees = attendees.filter(id => id !== playerId);
  }
}

/* =========================
   QUICK TEXT (WhatsApp)
========================= */
function processQuickText() {
  const text = ($.attendanceText?.value || "").toLowerCase();

  players.forEach(player => {
    const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
    const checkbox = document.querySelector(`.attendance-check[data-id="${player.id}"]`);
    if (!checkbox) return;

    if (text.includes(player.firstName.toLowerCase()) || text.includes(fullName)) {
      checkbox.checked = true;
      if (!attendees.includes(player.id)) attendees.push(player.id);
    }
  });
}

/* =========================
   SAVE
========================= */
async function saveTraining() {
  const date = $.trainingDate?.value;
  if (!date) return alert("Selecciona una fecha");

  const hasPick = selectedDrillIds.length || selectedPlaybookTrainingIds.length;
  const hasSummary = ($.summary?.value || "").trim().length > 0;

  // ✅ regla: o seleccionás o describís en summary
  if (!hasPick && !hasSummary) {
    alert("Seleccioná drills/entrenos del playbook o escribí qué se trabajó en el resumen.");
    return;
  }

  const payload = {
    clubId,
    date,
    month: date.slice(0, 7),
    attendees,
    playbookTrainingIds: [...selectedPlaybookTrainingIds],
    drillIds: [...selectedDrillIds],
    summary: ($.summary?.value || "").trim(),
    notes: ($.notes?.value || "").trim(),
    active: true,
  };

  $.saveBtn.disabled = true;
  showLoading();

  try {
    if (currentTrainingId) {
      await updateDoc(doc(db, COL_TRAININGS, currentTrainingId), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, COL_TRAININGS), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // cerrar
    bootstrap.Modal.getInstance($.modal)?.hide();

    // reset + reload list
    resetModal();
    await loadTrainings();
  } catch (e) {
    console.error(e);
    alert("❌ Error guardando entreno");
  } finally {
    $.saveBtn.disabled = false;
    hideLoading();
  }
}

/* =========================
   EVENTS
========================= */
function bindEvents() {
  $.saveBtn?.addEventListener("click", saveTraining);
  $.processBtn?.addEventListener("click", processQuickText);

  // cuando se cierra, reset (sin re-abrir)
  $.modal?.addEventListener("hidden.bs.modal", () => {
    // reset silencioso
    currentTrainingId = null;
    attendees = [];
    selectedDrillIds = [];
    selectedPlaybookTrainingIds = [];

    if ($.modalTitle) $.modalTitle.innerText = "Nuevo entrenamiento";
    $.quickTextSection && ($.quickTextSection.style.display = "block");

    if ($.trainingDate) $.trainingDate.value = "";
    if ($.summary) $.summary.value = "";
    if ($.notes) $.notes.value = "";
    if ($.attendanceText) $.attendanceText.value = "";

    document.querySelectorAll(".attendance-check").forEach(cb => (cb.checked = false));

    const tSearch = document.getElementById("pbTrainingSearch");
    const dSearch = document.getElementById("pbDrillSearch");
    if (tSearch) tSearch.value = "";
    if (dSearch) dSearch.value = "";

    renderPlaybookSelectors();
  });

  // botón "+ Nuevo entrenamiento" ya abre por data-bs-target, pero queremos setear estado limpio
  // escuchamos el show del modal y si no hay currentTrainingId, dejamos "nuevo"
  $.modal?.addEventListener("show.bs.modal", () => {
    if (!currentTrainingId) {
      // estado nuevo
      attendees = [];
      selectedDrillIds = [];
      selectedPlaybookTrainingIds = [];
      renderPlaybookSelectors();
    }
  });
}

/* =========================
   UTILS
========================= */
function norm(s) {
  return (s || "").toString().toLowerCase().trim();
}

function shortTitle(s) {
  const t = (s || "").toString().trim();
  if (!t) return "-";
  return t.length > 60 ? t.slice(0, 60) + "…" : t;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getDrillName(id) {
  const d = pbDrills.find(x => x.id === id);
  return d?.name || null;
}

function getPlaybookTrainingName(id) {
  const t = pbTrainings.find(x => x.id === id);
  return t?.name || null;
}

function trainingDisplayText(t) {
  const summary = (t.summary || "").trim();
  if (summary) return summary;

  const names = [];

  // primero entrenamientos completos
  if (Array.isArray(t.playbookTrainingIds)) {
    for (const id of t.playbookTrainingIds) {
      const nm = getPlaybookTrainingName(id);
      if (nm) names.push(nm);
    }
  }

  // luego drills sueltos
  if (Array.isArray(t.drillIds)) {
    for (const id of t.drillIds) {
      const nm = getDrillName(id);
      if (nm) names.push(nm);
    }
  }

  if (!names.length) return "-";
  return names.join(", ");
}

function parseISODate(iso) {
  // iso: "YYYY-MM-DD"
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return isNaN(d) ? null : d;
}

function fmtHumanDayMonth(iso) {
  const d = parseISODate(iso);
  if (!d) return "—";
  // "febrero 24" -> capitalizamos mes
  const month = d.toLocaleDateString("es-CR", { month: "long" });
  const day = d.toLocaleDateString("es-CR", { day: "2-digit" });
  const capMonth = month.charAt(0).toUpperCase() + month.slice(1);
  return `${capMonth} ${day}`;
}

function trainingLabel(t, idx, total) {
  // idx viene del render (0..total-1) en orden DESC.
  // Queremos #1 el más viejo => número = total - idx
  const n = total - idx;
  return `Entreno #${n}: ${fmtHumanDayMonth(t.date)}`;
}
// js/features/playbook/playbook.js
import { db } from "../../firebase.js";
import { watchAuth } from "../../auth.js";
import { showLoader, hideLoader } from "../../ui/loader.js";

import { guardPage } from "../../page-guard.js";
import { loadHeader } from "../../components/header.js";

import { CLUB_DATA } from "../../strings.js";
import { PLAYBOOK_STRINGS as S } from "../../strings/playbook_strings.js";

import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   Collections
========================= */
const COL_DRILLS = "drills";
const COL_PLAYBOOK_TRAININGS = "playbook_trainings";

/* =========================
   State
========================= */
let $ = {};
let clubId = CLUB_DATA?.club?.id || "volcanes";

let canEdit = false;
let drills = [];
let trainings = [];

let selectedTrainingId = null;
let selectedTraining = null;
let trainingWorkingRefs = []; // [{drillId, order}]

/* =========================
   INIT (igual patrón dashboard)
========================= */
const { cfg, redirected } = await guardPage("playbook");
if (!redirected) {
  await loadHeader("playbook", cfg); // 👈 entry point para navegar + colores club
}

cacheDom();
bindEvents();

watchAuth(async () => {
  showLoader();
  try {
    // permisos recomendados: admin edita, otros ven
    canEdit = isAdminFromCfg(cfg);
    setRoleUI();

    $.pageSubtitle.textContent = canEdit ? S.ui.subtitleAdmin : S.ui.subtitleViewer;

    await loadDrills();
    await loadTrainings();
  } finally {
    hideLoader();
    document.body.classList.remove("loading");
  }
});

/* =========================
   Permissions
========================= */
function isAdminFromCfg(cfg) {
  const role = (cfg?.role || cfg?.userRole || cfg?.authRole || "").toString().toLowerCase();
  if (role === "admin") return true;
  if (cfg?.isAdmin === true) return true;
  return false;
}

function setRoleUI() {
  const badge = $.roleBadge;
  badge.classList.remove("d-none");

  if (canEdit) {
    badge.className = "badge text-bg-primary";
    badge.textContent = "ADMIN (EDIT)";

    $.openCreateDrillBtn?.classList.remove("d-none");
    $.trainingCreateBox.classList.remove("d-none");
    $.trainingDrillAddBox.classList.remove("d-none");
    $.saveTrainingBtn.classList.remove("d-none");
  } else {
    badge.className = "badge text-bg-secondary";
    badge.textContent = "VIEW ONLY";

    $.openCreateDrillBtn?.classList.add("d-none");
    $.trainingCreateBox.classList.add("d-none");
    $.trainingDrillAddBox.classList.add("d-none");
    $.saveTrainingBtn.classList.add("d-none");
  }
}


/* =========================
   DOM
========================= */
function cacheDom() {
  $ = {
    pageSubtitle: document.getElementById("pageSubtitle"),
    roleBadge: document.getElementById("roleBadge"),
    alertBox: document.getElementById("alertBox"),

    // Drills
    drillForm: document.getElementById("drillForm"),
    drillName: document.getElementById("drillName"),
    drillAuthor: document.getElementById("drillAuthor"),
    drillTacticalUrl: document.getElementById("drillTacticalUrl"),
    drillVideoUrl: document.getElementById("drillVideoUrl"),
    drillObjective: document.getElementById("drillObjective"),
    drillVolume: document.getElementById("drillVolume"),
    drillRest: document.getElementById("drillRest"),
    drillRecs: document.getElementById("drillRecs"),

    openCreateDrillBtn: document.getElementById("openCreateDrillBtn"),
    createDrillModal: document.getElementById("createDrillModal"),
    saveCreateDrillBtn: document.getElementById("saveCreateDrillBtn"),

    drillSearch: document.getElementById("drillSearch"),
    showArchivedSwitch: document.getElementById("showArchivedSwitch"),
    refreshDrillsBtn: document.getElementById("refreshDrillsBtn"),
    drillsList: document.getElementById("drillsList"),
    drillsEmpty: document.getElementById("drillsEmpty"),

    // Trainings
    trainingCreateBox: document.getElementById("trainingCreateBox"),
    trainingForm: document.getElementById("trainingForm"),
    trainingName: document.getElementById("trainingName"),
    trainingDate: document.getElementById("trainingDate"),
    trainingWeekHint: document.getElementById("trainingWeekHint"),
    trainingNotes: document.getElementById("trainingNotes"),
    trainingSearch: document.getElementById("trainingSearch"),
    refreshTrainingsBtn: document.getElementById("refreshTrainingsBtn"),
    trainingsList: document.getElementById("trainingsList"),
    trainingsEmpty: document.getElementById("trainingsEmpty"),

    trainingEditorTitle: document.getElementById("trainingEditorTitle"),
    trainingEditorSubtitle: document.getElementById("trainingEditorSubtitle"),
    trainingMetaBox: document.getElementById("trainingMetaBox"),
    trainingMetaName: document.getElementById("trainingMetaName"),
    trainingMetaDate: document.getElementById("trainingMetaDate"),
    trainingMetaNotes: document.getElementById("trainingMetaNotes"),

    trainingDrillAddBox: document.getElementById("trainingDrillAddBox"),
    drillsDatalist: document.getElementById("drillsDatalist"),
    trainingDrillPicker: document.getElementById("trainingDrillPicker"),
    addDrillToTrainingBtn: document.getElementById("addDrillToTrainingBtn"),

    trainingDrillsList: document.getElementById("trainingDrillsList"),
    trainingDrillsEmpty: document.getElementById("trainingDrillsEmpty"),

    openCreateDrillBtn: document.getElementById("openCreateDrillBtn"),
    createDrillModal: document.getElementById("createDrillModal"),
    saveCreateDrillBtn: document.getElementById("saveCreateDrillBtn"),

    saveTrainingBtn: document.getElementById("saveTrainingBtn"),
  };
}

/* =========================
   Alerts
========================= */
function showAlert(msg, type = "info") {
  const el = $.alertBox;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove("d-none");
}

function clearAlert() {
  $.alertBox.classList.add("d-none");
}

/* =========================
   Load Data
========================= */
async function loadDrills() {
  const showArchived = !!$.showArchivedSwitch.checked;

  const filters = [where("clubId", "==", clubId)];
  if (!showArchived) filters.push(where("isActive", "==", true));

  const qy = query(collection(db, COL_DRILLS), ...filters, orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);

  drills = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderDrills();
  renderDrillsDatalist();
}

async function loadTrainings() {
  const qy = query(
    collection(db, COL_PLAYBOOK_TRAININGS),
    where("clubId", "==", clubId),
    orderBy("date", "desc")
  );

  const snap = await getDocs(qy);
  trainings = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  renderTrainingsList();

  if (selectedTrainingId) {
    const still = trainings.find(t => t.id === selectedTrainingId);
    if (still) await selectTraining(selectedTrainingId);
    else clearTrainingEditor();
  }
}

/* =========================
   Render Drills
========================= */
function renderDrills() {
  const term = norm($.drillSearch.value);
  const filtered = term ? drills.filter(d => drillMatches(d, term)) : drills;

  $.drillsList.innerHTML = "";

  if (!filtered.length) {
    $.drillsEmpty.classList.remove("d-none");
    return;
  }
  $.drillsEmpty.classList.add("d-none");

  for (const d of filtered) {
    const card = document.createElement("div");
    card.className = "col-12 col-lg-6";

    const tactical = safeUrl(d.tacticalBoardUrl);
    const video = safeUrl(d.teamVideoUrl);
    const active = d.isActive !== false;

    card.innerHTML = `
      <div class="card h-100">
        <div class="card-body">
          <div class="d-flex justify-content-between gap-2">
            <div>
              <div class="fw-semibold">${escapeHtml(d.name || "—")}</div>
              <div class="text-muted small">Autor: ${escapeHtml(d.authorName || "—")}</div>
              <div class="mt-2 small">
                ${tactical ? `<a href="${tactical}" target="_blank" rel="noopener">Tactical</a>` : `<span class="text-muted">Sin Tactical</span>`}
                <span class="mx-2">•</span>
                ${video ? `<a href="${video}" target="_blank" rel="noopener">Video</a>` : `<span class="text-muted">Sin video</span>`}
              </div>
            </div>

            <div class="text-end">
              <span class="badge ${active ? "text-bg-success" : "text-bg-secondary"}">${active ? "Activo" : "Archivado"}</span>
              ${
                canEdit
                  ? `<div class="mt-2 d-flex gap-2 justify-content-end">
                       <button class="btn btn-outline-danger btn-sm" data-action="toggle" data-id="${d.id}">
                         ${active ? "Archivar" : "Reactivar"}
                       </button>
                     </div>`
                  : ``
              }
            </div>
          </div>

          <hr />

          <div class="small text-muted">Objetivo</div>
          <div>${escapeHtml(d.objective || "—")}</div>

          <div class="row mt-2 g-2">
            <div class="col-6">
              <div class="small text-muted">Volumen</div>
              <div>${escapeHtml(d.volume || "—")}</div>
            </div>
            <div class="col-6">
              <div class="small text-muted">Descanso</div>
              <div>${escapeHtml(d.restAfter || "—")}</div>
            </div>
          </div>

          <div class="mt-2">
            <div class="small text-muted">Recomendaciones</div>
            <div class="text-muted">${escapeHtml(d.recommendations || "—")}</div>
          </div>
        </div>
      </div>
    `;

    $.drillsList.appendChild(card);
  }

  // Actions
  if (canEdit) {
    $.drillsList.querySelectorAll("button[data-action='toggle']").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;
        showLoader();
        try {
          await toggleDrillActive(id);
        } finally {
          hideLoader();
        }
      });
    });
  }
}

function renderDrillsDatalist() {
  const active = drills.filter(d => d.isActive !== false);
  $.drillsDatalist.innerHTML = active
    .map(d => `<option value="${escapeHtml(d.name)}"></option>`)
    .join("");
}

function drillMatches(d, term) {
  const hay = [
    d.name, d.authorName, d.objective, d.volume, d.restAfter, d.recommendations
  ].map(norm).join(" ");
  return hay.includes(term);
}

/* =========================
   Trainings render / select
========================= */
function renderTrainingsList() {
  const term = norm($.trainingSearch.value);
  const filtered = term ? trainings.filter(t => norm(t.name).includes(term)) : trainings;

  $.trainingsList.innerHTML = "";

  if (!filtered.length) {
    $.trainingsEmpty.classList.remove("d-none");
    return;
  }
  $.trainingsEmpty.classList.add("d-none");

  for (const t of filtered) {
    const isSelected = t.id === selectedTrainingId;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `list-group-item list-group-item-action ${isSelected ? "active" : ""}`;
    btn.innerHTML = `
      <div class="d-flex justify-content-between">
        <div>
          <div class="fw-semibold">${escapeHtml(t.name || "—")}</div>
          <div class="small ${isSelected ? "text-white-50" : "text-muted"}">${fmtDate(t.date)}</div>
        </div>
        <div class="small ${isSelected ? "text-white-50" : "text-muted"}">
          ${(t.drillRefs || []).length} drills
        </div>
      </div>
    `;
    btn.addEventListener("click", () => selectTraining(t.id));
    $.trainingsList.appendChild(btn);
  }
}

async function selectTraining(id) {
  selectedTrainingId = id;
  renderTrainingsList();

  const t = trainings.find(x => x.id === id);
  if (!t) return clearTrainingEditor();

  selectedTraining = hydrateTraining(t);
  trainingWorkingRefs = [...selectedTraining.drillRefs];

  $.trainingEditorTitle.textContent = selectedTraining.name || "Entrenamiento";
  $.trainingEditorSubtitle.textContent = `${fmtDate(selectedTraining.date)} · ${trainingWorkingRefs.length} drills`;

  $.trainingMetaBox.classList.remove("d-none");
  $.trainingMetaName.textContent = selectedTraining.name || "—";
  $.trainingMetaDate.textContent = fmtDate(selectedTraining.date);
  $.trainingMetaNotes.textContent = selectedTraining.notes || "—";

  renderTrainingDrills();
}

function hydrateTraining(t) {
  const refs = Array.isArray(t.drillRefs) ? t.drillRefs : [];
  const normalized = refs
    .map((r, idx) => ({
      drillId: r.drillId,
      order: Number.isFinite(r.order) ? r.order : (idx + 1),
    }))
    .filter(r => !!r.drillId)
    .sort((a, b) => a.order - b.order);

  return { ...t, drillRefs: normalized };
}

function renderTrainingDrills() {
  $.trainingDrillsList.innerHTML = "";

  if (!selectedTrainingId) {
    $.trainingDrillsEmpty.classList.add("d-none");
    return;
  }

  const ordered = [...trainingWorkingRefs].sort((a, b) => a.order - b.order);
  if (!ordered.length) {
    $.trainingDrillsEmpty.classList.remove("d-none");
    return;
  }
  $.trainingDrillsEmpty.classList.add("d-none");

  ordered.forEach((ref, idx) => {
    const d = drills.find(x => x.id === ref.drillId);
    const name = d?.name || "(drill eliminado)";

    const item = document.createElement("div");
    item.className = "list-group-item";
    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <div class="fw-semibold">
            <span class="text-muted me-2">${idx + 1}.</span>${escapeHtml(name)}
          </div>
        </div>

        ${
          canEdit
            ? `<div class="btn-group btn-group-sm">
                 <button class="btn btn-outline-secondary" data-action="up" ${idx === 0 ? "disabled" : ""}>↑</button>
                 <button class="btn btn-outline-secondary" data-action="down" ${idx === ordered.length - 1 ? "disabled" : ""}>↓</button>
                 <button class="btn btn-outline-danger" data-action="remove">✕</button>
               </div>`
            : ``
        }
      </div>
    `;

    if (canEdit) {
      item.querySelector("button[data-action='up']")?.addEventListener("click", () => moveTrainingRef(idx, -1));
      item.querySelector("button[data-action='down']")?.addEventListener("click", () => moveTrainingRef(idx, +1));
      item.querySelector("button[data-action='remove']")?.addEventListener("click", () => removeTrainingRef(idx));
    }

    $.trainingDrillsList.appendChild(item);
  });
}

function clearTrainingEditor() {
  selectedTrainingId = null;
  selectedTraining = null;
  trainingWorkingRefs = [];

  $.trainingEditorTitle.textContent = "Seleccioná un entrenamiento";
  $.trainingEditorSubtitle.textContent = "—";
  $.trainingMetaBox.classList.add("d-none");
  $.trainingDrillsList.innerHTML = "";
  $.trainingDrillsEmpty.classList.add("d-none");
}

/* =========================
   CRUD
========================= */
async function createDrillFromForm() {
  clearAlert();

  const name = ($.drillName.value || "").trim();
  const authorName = ($.drillAuthor.value || "").trim();
  if (!name || !authorName) {
    showAlert(S.errors.required, "warning");
    return;
  }

  await addDoc(collection(db, COL_DRILLS), {
    clubId,
    name,
    authorName,
    tacticalBoardUrl: safeUrl($.drillTacticalUrl.value) || "",
    teamVideoUrl: safeUrl($.drillVideoUrl.value) || "",
    objective: ($.drillObjective.value || "").trim(),
    volume: ($.drillVolume.value || "").trim(),
    restAfter: ($.drillRest.value || "").trim(),
    recommendations: ($.drillRecs.value || "").trim(),
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  $.drillForm.reset();
  showAlert(S.ok.drillCreated, "success");
  await loadDrills();
}

async function toggleDrillActive(drillId) {
  const d = drills.find(x => x.id === drillId);
  if (!d) return;

  const next = !(d.isActive !== false);
  await updateDoc(doc(db, COL_DRILLS, drillId), {
    isActive: next,
    updatedAt: serverTimestamp(),
  });

  showAlert(next ? S.ok.drillReactivated : S.ok.drillArchived, "success");
  await loadDrills();
}

async function createTrainingFromForm() {
  clearAlert();
  const name = ($.trainingName.value || "").trim();
  const dateStr = ($.trainingDate.value || "").trim();

  if (!name || !dateStr) {
    showAlert(S.errors.required, "warning");
    return;
  }

  await addDoc(collection(db, COL_PLAYBOOK_TRAININGS), {
    clubId,
    name,
    notes: ($.trainingNotes.value || "").trim(),
    date: new Date(`${dateStr}T00:00:00`),
    drillRefs: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  $.trainingForm.reset();
  $.trainingWeekHint.textContent = "—";

  showAlert(S.ok.trainingCreated, "success");
  await loadTrainings();
}

function addDrillToTraining() {
  clearAlert();
  if (!selectedTrainingId) return showAlert(S.errors.noTrainingSelected, "warning");

  const val = ($.trainingDrillPicker.value || "").trim();
  if (!val) return;

  const drill = drills.find(d => norm(d.name) === norm(val));
  if (!drill) return showAlert(S.errors.drillNotFound, "warning");

  if (trainingWorkingRefs.some(r => r.drillId === drill.id)) {
    return showAlert(S.errors.drillAlreadyAdded, "warning");
  }

  const maxOrder = trainingWorkingRefs.reduce((m, r) => Math.max(m, r.order || 0), 0);
  trainingWorkingRefs.push({ drillId: drill.id, order: maxOrder + 1 });

  $.trainingDrillPicker.value = "";
  renderTrainingDrills();
  $.trainingEditorSubtitle.textContent = `${fmtDate(selectedTraining?.date)} · ${trainingWorkingRefs.length} drills`;
}

function moveTrainingRef(index, delta) {
  const sorted = [...trainingWorkingRefs].sort((a, b) => a.order - b.order);
  const newIndex = index + delta;
  if (newIndex < 0 || newIndex >= sorted.length) return;

  const tmp = sorted[index];
  sorted[index] = sorted[newIndex];
  sorted[newIndex] = tmp;

  trainingWorkingRefs = sorted.map((r, idx) => ({ drillId: r.drillId, order: idx + 1 }));
  renderTrainingDrills();
}

function removeTrainingRef(index) {
  const sorted = [...trainingWorkingRefs].sort((a, b) => a.order - b.order);
  sorted.splice(index, 1);
  trainingWorkingRefs = sorted.map((r, idx) => ({ drillId: r.drillId, order: idx + 1 }));
  renderTrainingDrills();
  $.trainingEditorSubtitle.textContent = `${fmtDate(selectedTraining?.date)} · ${trainingWorkingRefs.length} drills`;
}

async function saveTraining() {
  clearAlert();
  if (!selectedTrainingId) return;

  const sorted = [...trainingWorkingRefs].sort((a, b) => a.order - b.order)
    .map((r, idx) => ({ drillId: r.drillId, order: idx + 1 }));

  await updateDoc(doc(db, COL_PLAYBOOK_TRAININGS, selectedTrainingId), {
    drillRefs: sorted,
    updatedAt: serverTimestamp(),
  });

  showAlert(S.ok.trainingSaved, "success");
  await loadTrainings();
}

/* =========================
   Events
========================= */
function bindEvents() {
    // Drills
    $.openCreateDrillBtn?.addEventListener("click", () => {
    if (!canEdit) return;
    clearAlert();
    $.drillForm?.reset();
    const modal = bootstrap.Modal.getOrCreateInstance($.createDrillModal);
    modal.show();
    });

    $.saveCreateDrillBtn?.addEventListener("click", async () => {
    if (!canEdit) return;
    showLoader();
    try {
        await createDrillFromForm();
        const modal = bootstrap.Modal.getOrCreateInstance($.createDrillModal);
        modal.hide();
    } finally {
        hideLoader();
    }
    });

    $.drillSearch?.addEventListener("input", renderDrills);

    $.showArchivedSwitch?.addEventListener("change", async () => {
    showLoader();
    try {
        await loadDrills();
    } finally {
        hideLoader();
    }
    });

    $.refreshDrillsBtn?.addEventListener("click", async () => {
    showLoader();
    try {
        await loadDrills();
    } finally {
        hideLoader();
    }
    });


  // Trainings
  $.trainingDate?.addEventListener("input", () => {
    $.trainingWeekHint.textContent = isoWeekLabel($.trainingDate.value);
  });

  $.trainingForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    showLoader();
    try {
      await createTrainingFromForm();
    } finally {
      hideLoader();
    }
  });

  $.trainingSearch?.addEventListener("input", renderTrainingsList);

  $.refreshTrainingsBtn?.addEventListener("click", async () => {
    showLoader();
    try {
      await loadTrainings();
    } finally {
      hideLoader();
    }
  });

  $.addDrillToTrainingBtn?.addEventListener("click", () => {
    if (!canEdit) return;
    addDrillToTraining();
  });

  $.trainingDrillPicker?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!canEdit) return;
      addDrillToTraining();
    }
  });

  $.saveTrainingBtn?.addEventListener("click", async () => {
    if (!canEdit) return;
    showLoader();
    try {
      await saveTraining();
    } finally {
      hideLoader();
    }
  });
}

/* =========================
   Utils
========================= */
function norm(s) {
  return (s || "").toString().toLowerCase().trim();
}

function safeUrl(url) {
  const u = (url || "").toString().trim();
  if (!u) return "";
  try { return new URL(u).toString(); } catch { return ""; }
}

function fmtDate(value) {
  if (!value) return "—";
  const d = value?.toDate?.() ?? new Date(value);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("es-CR", { year: "numeric", month: "short", day: "2-digit" });
}

function isoWeekLabel(dateInput) {
  if (!dateInput) return "—";
  const d = new Date(`${dateInput}T00:00:00`);
  if (isNaN(d)) return "—";

  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  return `Semana ${weekNo} (${tmp.getUTCFullYear()})`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

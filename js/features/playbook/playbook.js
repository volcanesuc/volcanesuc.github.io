// js/features/playbook/playbook.js
import { db } from "../../firebase.js";
import { watchAuth, logout } from "../../auth.js";
import { loadHeader } from "../../components/header.js";
import { showLoader, hideLoader } from "../../ui/loader.js";

import { CLUB_DATA } from "../../strings.js";
import { PLAYBOOK_STRINGS as S } from "../../strings/playbook.js";

import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getAuth,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* =========================
   Collections
========================= */
const COL_DRILLS = "drills";
const COL_PLAYBOOK_TRAININGS = "playbook_trainings";

/* =========================
   State
========================= */
let $ = {};
let _unsubAuth = null;

let clubId = CLUB_DATA?.club?.id || "volcanes";
let canEdit = false;

let drills = [];              // full list
let trainings = [];           // full list
let selectedTrainingId = null;
let selectedTraining = null;  // hydrated
let trainingWorkingRefs = []; // array of { drillId, order }

/* =========================
   Helpers
========================= */
function norm(s) {
  return (s || "").toString().toLowerCase().trim();
}

function safeUrl(url) {
  const u = (url || "").toString().trim();
  if (!u) return "";
  try {
    const parsed = new URL(u);
    return parsed.toString();
  } catch {
    return "";
  }
}

function showAlert(msg, type = "info") {
  const el = $.alertBox;
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove("d-none");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearAlert() {
  $.alertBox?.classList.add("d-none");
}

function fmtDate(d) {
  if (!d) return "—";
  // Firestore Timestamp support
  const jsDate = (typeof d.toDate === "function") ? d.toDate() : new Date(d);
  if (Number.isNaN(jsDate.getTime())) return "—";
  return jsDate.toLocaleDateString("es-CR", { year: "numeric", month: "short", day: "2-digit" });
}

function isoWeekLabel(dateInput) {
  // dateInput: "YYYY-MM-DD"
  if (!dateInput) return "—";
  const d = new Date(`${dateInput}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";

  // ISO week calc
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  return `Semana ${weekNo} (${tmp.getUTCFullYear()})`;
}

function isAdminByCfg(cfg) {
  // flexible for your config patterns
  // supports: cfg.role === 'admin', cfg.userRole === 'admin', cfg.isAdmin === true
  const role =
    cfg?.role ||
    cfg?.userRole ||
    cfg?.authRole ||
    cfg?.membershipRole ||
    null;

  if (role && norm(role) === "admin") return true;
  if (cfg?.isAdmin === true) return true;

  // Also allow: cfg.adminUids contains current uid (if you maintain that)
  const uid = getAuth().currentUser?.uid;
  if (uid && Array.isArray(cfg?.adminUids) && cfg.adminUids.includes(uid)) return true;

  return false;
}

async function isAdminByClaims(user) {
  try {
    const res = await getIdTokenResult(user, true);
    // common patterns: claims.admin === true OR claims.role === "admin"
    if (res?.claims?.admin === true) return true;
    if (norm(res?.claims?.role) === "admin") return true;
    return false;
  } catch {
    return false;
  }
}

function setRoleUI() {
  const badge = $.roleBadge;
  if (!badge) return;

  badge.classList.remove("d-none");
  if (canEdit) {
    badge.className = "badge text-bg-primary";
    badge.textContent = "ADMIN (EDIT)";
    $.drillCreateCard?.classList.remove("d-none");
    $.trainingCreateBox?.classList.remove("d-none");
    $.trainingDrillAddBox?.classList.remove("d-none");
    $.saveTrainingBtn?.classList.remove("d-none");
    $.saveDrillEditBtn?.classList.remove("d-none");
  } else {
    badge.className = "badge text-bg-secondary";
    badge.textContent = "VIEW ONLY";
    $.drillCreateCard?.classList.add("d-none");
    $.trainingCreateBox?.classList.add("d-none");
    $.trainingDrillAddBox?.classList.add("d-none");
    $.saveTrainingBtn?.classList.add("d-none");
    $.saveDrillEditBtn?.classList.add("d-none");
  }
}

/* =========================
   DOM
========================= */
function cacheDom() {
  $ = {
    alertBox: document.getElementById("alertBox"),
    logoutBtn: document.getElementById("logoutBtn"),

    roleBadge: document.getElementById("roleBadge"),
    pageSubtitle: document.getElementById("pageSubtitle"),

    // Drills
    drillCreateCard: document.getElementById("drillCreateCard"),
    drillForm: document.getElementById("drillForm"),
    drillName: document.getElementById("drillName"),
    drillAuthor: document.getElementById("drillAuthor"),
    drillTacticalUrl: document.getElementById("drillTacticalUrl"),
    drillVideoUrl: document.getElementById("drillVideoUrl"),
    drillObjective: document.getElementById("drillObjective"),
    drillVolume: document.getElementById("drillVolume"),
    drillRest: document.getElementById("drillRest"),
    drillRecs: document.getElementById("drillRecs"),

    drillSearch: document.getElementById("drillSearch"),
    showArchivedSwitch: document.getElementById("showArchivedSwitch"),
    refreshDrillsBtn: document.getElementById("refreshDrillsBtn"),
    drillsList: document.getElementById("drillsList"),
    drillsEmpty: document.getElementById("drillsEmpty"),

    // Drill Edit modal
    drillEditModal: document.getElementById("drillEditModal"),
    drillEditForm: document.getElementById("drillEditForm"),
    editDrillId: document.getElementById("editDrillId"),
    editDrillName: document.getElementById("editDrillName"),
    editDrillAuthor: document.getElementById("editDrillAuthor"),
    editDrillTacticalUrl: document.getElementById("editDrillTacticalUrl"),
    editDrillVideoUrl: document.getElementById("editDrillVideoUrl"),
    editDrillObjective: document.getElementById("editDrillObjective"),
    editDrillVolume: document.getElementById("editDrillVolume"),
    editDrillRest: document.getElementById("editDrillRest"),
    editDrillActive: document.getElementById("editDrillActive"),
    editDrillRecs: document.getElementById("editDrillRecs"),
    saveDrillEditBtn: document.getElementById("saveDrillEditBtn"),

    // Trainings
    refreshTrainingsBtn: document.getElementById("refreshTrainingsBtn"),
    trainingCreateBox: document.getElementById("trainingCreateBox"),
    trainingForm: document.getElementById("trainingForm"),
    trainingName: document.getElementById("trainingName"),
    trainingDate: document.getElementById("trainingDate"),
    trainingWeekHint: document.getElementById("trainingWeekHint"),
    trainingNotes: document.getElementById("trainingNotes"),

    trainingSearch: document.getElementById("trainingSearch"),
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

    saveTrainingBtn: document.getElementById("saveTrainingBtn"),
    openTrainingLinkBtn: document.getElementById("openTrainingLinkBtn"),
  };
}

/* =========================
   Data Load
========================= */
async function loadDrills() {
  const showArchived = !!$.showArchivedSwitch?.checked;

  const base = [
    where("clubId", "==", clubId),
  ];

  // Default: only active unless showArchived on
  if (!showArchived) base.push(where("isActive", "==", true));

  const qy = query(collection(db, COL_DRILLS), ...base, orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);
  drills = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

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
  trainings = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  renderTrainingsList();

  // keep selection if still exists
  if (selectedTrainingId) {
    const stillThere = trainings.find(t => t.id === selectedTrainingId);
    if (stillThere) {
      await selectTraining(selectedTrainingId);
    } else {
      clearTrainingEditor();
    }
  }
}

async function hydrateTraining(t) {
  // Ensure we have drillRefs always normalized/sorted
  const refs = Array.isArray(t.drillRefs) ? t.drillRefs : [];
  const normalized = refs
    .map((r, idx) => ({
      drillId: r.drillId,
      order: Number.isFinite(r.order) ? r.order : (idx + 1),
    }))
    .filter(r => !!r.drillId)
    .sort((a, b) => a.order - b.order);

  return {
    ...t,
    drillRefs: normalized,
  };
}

/* =========================
   Render: Drills
========================= */
function drillMatches(d, term) {
  const hay = [
    d.name, d.authorName, d.objective, d.volume, d.restAfter, d.recommendations
  ].map(norm).join(" ");
  return hay.includes(term);
}

function renderDrills() {
  const container = $.drillsList;
  if (!container) return;

  const term = norm($.drillSearch?.value);
  const filtered = term ? drills.filter(d => drillMatches(d, term)) : drills;

  container.innerHTML = "";

  if (!filtered.length) {
    $.drillsEmpty?.classList.remove("d-none");
    return;
  }
  $.drillsEmpty?.classList.add("d-none");

  for (const d of filtered) {
    const tactical = safeUrl(d.tacticalBoardUrl);
    const video = safeUrl(d.teamVideoUrl);

    const activeBadge = d.isActive === false
      ? `<span class="badge text-bg-secondary">Archivado</span>`
      : `<span class="badge text-bg-success">Activo</span>`;

    const editBtns = canEdit ? `
      <div class="d-flex gap-2">
        <button class="btn btn-outline-primary btn-sm" data-action="edit" data-id="${d.id}">
          <i class="bi bi-pencil me-1"></i>Editar
        </button>
        <button class="btn btn-outline-danger btn-sm" data-action="toggleActive" data-id="${d.id}">
          <i class="bi bi-archive me-1"></i>${d.isActive === false ? "Reactivar" : "Archivar"}
        </button>
      </div>
    ` : ``;

    const links = `
      <div class="d-flex flex-wrap gap-2">
        ${tactical ? `<a class="link-icon" href="${tactical}" target="_blank" rel="noopener"><i class="bi bi-diagram-3 me-1"></i>Tactical</a>` : `<span class="text-secondary"><i class="bi bi-diagram-3 me-1"></i>Sin Tactical</span>`}
        ${video ? `<a class="link-icon" href="${video}" target="_blank" rel="noopener"><i class="bi bi-play-circle me-1"></i>Video</a>` : `<span class="text-secondary"><i class="bi bi-play-circle me-1"></i>Sin video</span>`}
      </div>
    `;

    const card = document.createElement("div");
    card.className = "col-12 col-lg-6";
    card.innerHTML = `
      <div class="card drill-card h-100">
        <div class="card-body">
          <div class="d-flex align-items-start justify-content-between gap-2">
            <div>
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <h3 class="h6 mb-0">${escapeHtml(d.name || "—")}</h3>
                ${activeBadge}
              </div>
              <div class="text-secondary small mt-1">
                <i class="bi bi-person me-1"></i>${escapeHtml(d.authorName || "—")}
              </div>
            </div>
            ${editBtns}
          </div>

          <hr class="my-3" />

          ${links}

          <div class="mt-2">
            <div class="small text-secondary mb-1">Objetivo</div>
            <div>${escapeHtml(d.objective || "—")}</div>
          </div>

          <div class="row g-2 mt-2">
            <div class="col-6">
              <div class="small text-secondary mb-1">Volumen</div>
              <div>${escapeHtml(d.volume || "—")}</div>
            </div>
            <div class="col-6">
              <div class="small text-secondary mb-1">Descanso</div>
              <div>${escapeHtml(d.restAfter || "—")}</div>
            </div>
          </div>

          <div class="mt-2">
            <div class="small text-secondary mb-1">Recomendaciones</div>
            <div class="muted">${escapeHtml(d.recommendations || "—")}</div>
          </div>

        </div>
      </div>
    `;

    container.appendChild(card);
  }

  // attach handlers for edit/toggle
  container.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      if (!id) return;

      if (action === "edit") openEditModal(id);
      if (action === "toggleActive") toggleDrillActive(id);
    });
  });
}

function renderDrillsDatalist() {
  const dl = $.drillsDatalist;
  if (!dl) return;

  const active = drills.filter(d => d.isActive !== false);
  dl.innerHTML = active
    .map(d => `<option value="${escapeHtml(d.name)}" data-id="${d.id}"></option>`)
    .join("");
}

function findDrillByName(name) {
  const key = norm(name);
  return drills.find(d => norm(d.name) === key);
}

function escapeHtml(str) {
  return (str || "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   Drill CRUD
========================= */
async function createDrillFromForm() {
  clearAlert();
  const name = ($.drillName?.value || "").trim();
  const authorName = ($.drillAuthor?.value || "").trim();
  if (!name || !authorName) {
    showAlert(S.errors.required, "warning");
    return;
  }

  const tacticalBoardUrl = safeUrl($.drillTacticalUrl?.value);
  const teamVideoUrl = safeUrl($.drillVideoUrl?.value);

  const payload = {
    clubId,
    name,
    authorName,
    authorUid: getAuth().currentUser?.uid || null,

    tacticalBoardUrl: tacticalBoardUrl || "",
    teamVideoUrl: teamVideoUrl || "",
    objective: ($.drillObjective?.value || "").trim(),
    volume: ($.drillVolume?.value || "").trim(),
    restAfter: ($.drillRest?.value || "").trim(),
    recommendations: ($.drillRecs?.value || "").trim(),

    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await addDoc(collection(db, COL_DRILLS), payload);
  $.drillForm?.reset();
  showAlert(S.ok.drillCreated, "success");
  await loadDrills();
}

function openEditModal(drillId) {
  const d = drills.find(x => x.id === drillId);
  if (!d) return;

  $.editDrillId.value = d.id;
  $.editDrillName.value = d.name || "";
  $.editDrillAuthor.value = d.authorName || "";
  $.editDrillTacticalUrl.value = d.tacticalBoardUrl || "";
  $.editDrillVideoUrl.value = d.teamVideoUrl || "";
  $.editDrillObjective.value = d.objective || "";
  $.editDrillVolume.value = d.volume || "";
  $.editDrillRest.value = d.restAfter || "";
  $.editDrillRecs.value = d.recommendations || "";
  $.editDrillActive.value = String(d.isActive !== false);

  const modal = bootstrap.Modal.getOrCreateInstance($.drillEditModal);
  modal.show();
}

async function saveDrillEdits() {
  clearAlert();
  const id = $.editDrillId?.value;
  if (!id) return;

  const name = ($.editDrillName?.value || "").trim();
  const authorName = ($.editDrillAuthor?.value || "").trim();
  if (!name || !authorName) {
    showAlert(S.errors.required, "warning");
    return;
  }

  const payload = {
    name,
    authorName,
    tacticalBoardUrl: safeUrl($.editDrillTacticalUrl?.value) || "",
    teamVideoUrl: safeUrl($.editDrillVideoUrl?.value) || "",
    objective: ($.editDrillObjective?.value || "").trim(),
    volume: ($.editDrillVolume?.value || "").trim(),
    restAfter: ($.editDrillRest?.value || "").trim(),
    recommendations: ($.editDrillRecs?.value || "").trim(),
    isActive: $.editDrillActive?.value === "true",
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, COL_DRILLS, id), payload);

  const modal = bootstrap.Modal.getOrCreateInstance($.drillEditModal);
  modal.hide();

  showAlert(S.ok.drillUpdated, "success");
  await loadDrills();
}

async function toggleDrillActive(drillId) {
  const d = drills.find(x => x.id === drillId);
  if (!d) return;

  const next = !(d.isActive !== false); // if active -> false, if archived -> true
  await updateDoc(doc(db, COL_DRILLS, drillId), {
    isActive: next,
    updatedAt: serverTimestamp(),
  });

  showAlert(next ? S.ok.drillReactivated : S.ok.drillArchived, "success");
  await loadDrills();
}

/* =========================
   Render: Trainings
========================= */
function trainingMatches(t, term) {
  const hay = [t.name, t.notes].map(norm).join(" ");
  return hay.includes(term);
}

function renderTrainingsList() {
  const container = $.trainingsList;
  if (!container) return;

  const term = norm($.trainingSearch?.value);
  const filtered = term ? trainings.filter(t => trainingMatches(t, term)) : trainings;

  container.innerHTML = "";

  if (!filtered.length) {
    $.trainingsEmpty?.classList.remove("d-none");
    return;
  }
  $.trainingsEmpty?.classList.add("d-none");

  for (const t of filtered) {
    const isSelected = t.id === selectedTrainingId;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `list-group-item list-group-item-action ${isSelected ? "active" : ""}`;
    btn.innerHTML = `
      <div class="d-flex align-items-start justify-content-between gap-2">
        <div>
          <div class="fw-semibold">${escapeHtml(t.name || "—")}</div>
          <div class="small ${isSelected ? "text-white-50" : "text-secondary"}">
            <i class="bi bi-calendar-event me-1"></i>${fmtDate(t.date)}
          </div>
        </div>
        <div class="small ${isSelected ? "text-white-50" : "text-secondary"}">
          ${(Array.isArray(t.drillRefs) ? t.drillRefs.length : 0)} drills
        </div>
      </div>
    `;
    btn.addEventListener("click", () => selectTraining(t.id));
    container.appendChild(btn);
  }
}

function clearTrainingEditor() {
  selectedTrainingId = null;
  selectedTraining = null;
  trainingWorkingRefs = [];

  $.trainingEditorTitle.textContent = "Seleccioná un entrenamiento";
  $.trainingEditorSubtitle.textContent = "—";

  $.trainingMetaBox?.classList.add("d-none");
  $.trainingDrillsList.innerHTML = "";
  $.trainingDrillsEmpty?.classList.add("d-none");
}

async function selectTraining(id) {
  selectedTrainingId = id;
  renderTrainingsList();

  const t = trainings.find(x => x.id === id);
  if (!t) return clearTrainingEditor();

  selectedTraining = await hydrateTraining(t);
  trainingWorkingRefs = [...selectedTraining.drillRefs];

  const dateTxt = fmtDate(selectedTraining.date);
  $.trainingEditorTitle.textContent = selectedTraining.name || "Entrenamiento";
  $.trainingEditorSubtitle.textContent = `${dateTxt} · ${trainingWorkingRefs.length} drills`;

  // meta box
  $.trainingMetaBox?.classList.remove("d-none");
  $.trainingMetaName.textContent = selectedTraining.name || "—";
  $.trainingMetaDate.textContent = dateTxt;
  $.trainingMetaNotes.textContent = selectedTraining.notes || "—";

  renderTrainingDrills();
}

function renderTrainingDrills() {
  const container = $.trainingDrillsList;
  container.innerHTML = "";

  if (!selectedTrainingId) {
    $.trainingDrillsEmpty?.classList.add("d-none");
    return;
  }

  if (!trainingWorkingRefs.length) {
    $.trainingDrillsEmpty?.classList.remove("d-none");
    return;
  }
  $.trainingDrillsEmpty?.classList.add("d-none");

  const ordered = [...trainingWorkingRefs].sort((a, b) => a.order - b.order);

  for (let i = 0; i < ordered.length; i++) {
    const ref = ordered[i];
    const d = drills.find(x => x.id === ref.drillId);

    const name = d?.name || "(drill eliminado)";
    const tactical = safeUrl(d?.tacticalBoardUrl);
    const video = safeUrl(d?.teamVideoUrl);

    const canMoveUp = canEdit && i > 0;
    const canMoveDown = canEdit && i < ordered.length - 1;

    const controls = canEdit ? `
      <div class="btn-group btn-group-sm" role="group">
        <button class="btn btn-outline-secondary" data-action="up" ${canMoveUp ? "" : "disabled"}>
          <i class="bi bi-arrow-up"></i>
        </button>
        <button class="btn btn-outline-secondary" data-action="down" ${canMoveDown ? "" : "disabled"}>
          <i class="bi bi-arrow-down"></i>
        </button>
        <button class="btn btn-outline-danger" data-action="remove">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
    ` : "";

    const item = document.createElement("div");
    item.className = "list-group-item sortable-row";
    item.innerHTML = `
      <div class="d-flex align-items-start justify-content-between gap-2">
        <div>
          <div class="fw-semibold">
            <span class="text-secondary me-2">${i + 1}.</span>${escapeHtml(name)}
          </div>
          <div class="small text-secondary mt-1 d-flex gap-3 flex-wrap">
            ${tactical ? `<a href="${tactical}" target="_blank" rel="noopener"><i class="bi bi-diagram-3 me-1"></i>Tactical</a>` : `<span><i class="bi bi-diagram-3 me-1"></i>Sin Tactical</span>`}
            ${video ? `<a href="${video}" target="_blank" rel="noopener"><i class="bi bi-play-circle me-1"></i>Video</a>` : `<span><i class="bi bi-play-circle me-1"></i>Sin video</span>`}
          </div>
        </div>
        ${controls}
      </div>
    `;

    if (canEdit) {
      item.querySelectorAll("button[data-action]").forEach(btn => {
        btn.addEventListener("click", () => {
          const action = btn.getAttribute("data-action");
          if (action === "up") moveTrainingRef(i, -1);
          if (action === "down") moveTrainingRef(i, +1);
          if (action === "remove") removeTrainingRef(i);
        });
      });
    }

    container.appendChild(item);
  }
}

/* =========================
   Trainings CRUD
========================= */
async function createTrainingFromForm() {
  clearAlert();
  const name = ($.trainingName?.value || "").trim();
  const dateStr = ($.trainingDate?.value || "").trim();

  if (!name || !dateStr) {
    showAlert(S.errors.required, "warning");
    return;
  }

  const payload = {
    clubId,
    name,
    notes: ($.trainingNotes?.value || "").trim(),
    date: new Date(`${dateStr}T00:00:00`),
    drillRefs: [],
    createdByUid: getAuth().currentUser?.uid || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COL_PLAYBOOK_TRAININGS), payload);
  $.trainingForm?.reset();
  $.trainingWeekHint.textContent = "—";

  showAlert(S.ok.trainingCreated, "success");
  await loadTrainings();
  await selectTraining(ref.id);
}

function addDrillToTraining() {
  clearAlert();
  if (!selectedTrainingId) {
    showAlert(S.errors.noTrainingSelected, "warning");
    return;
  }

  const val = ($.trainingDrillPicker?.value || "").trim();
  if (!val) return;

  const drill = findDrillByName(val);
  if (!drill) {
    showAlert(S.errors.drillNotFound, "warning");
    return;
  }

  // prevent duplicates
  if (trainingWorkingRefs.some(r => r.drillId === drill.id)) {
    showAlert(S.errors.drillAlreadyAdded, "warning");
    return;
  }

  const maxOrder = trainingWorkingRefs.reduce((m, r) => Math.max(m, r.order || 0), 0);
  trainingWorkingRefs.push({ drillId: drill.id, order: maxOrder + 1 });

  $.trainingDrillPicker.value = "";
  renderTrainingDrills();
  $.trainingEditorSubtitle.textContent = `${fmtDate(selectedTraining?.date)} · ${trainingWorkingRefs.length} drills`;
}

function normalizeOrders() {
  const sorted = [...trainingWorkingRefs].sort((a, b) => a.order - b.order);
  trainingWorkingRefs = sorted.map((r, idx) => ({ drillId: r.drillId, order: idx + 1 }));
}

function moveTrainingRef(indexInRendered, delta) {
  const sorted = [...trainingWorkingRefs].sort((a, b) => a.order - b.order);
  const newIndex = indexInRendered + delta;
  if (newIndex < 0 || newIndex >= sorted.length) return;

  const tmp = sorted[indexInRendered];
  sorted[indexInRendered] = sorted[newIndex];
  sorted[newIndex] = tmp;

  trainingWorkingRefs = sorted.map((r, idx) => ({ drillId: r.drillId, order: idx + 1 }));
  renderTrainingDrills();
}

function removeTrainingRef(indexInRendered) {
  const sorted = [...trainingWorkingRefs].sort((a, b) => a.order - b.order);
  sorted.splice(indexInRendered, 1);
  trainingWorkingRefs = sorted.map((r, idx) => ({ drillId: r.drillId, order: idx + 1 }));
  renderTrainingDrills();
  $.trainingEditorSubtitle.textContent = `${fmtDate(selectedTraining?.date)} · ${trainingWorkingRefs.length} drills`;
}

async function saveTraining() {
  clearAlert();
  if (!selectedTrainingId) return;

  normalizeOrders();

  await updateDoc(doc(db, COL_PLAYBOOK_TRAININGS, selectedTrainingId), {
    drillRefs: trainingWorkingRefs,
    updatedAt: serverTimestamp(),
  });

  showAlert(S.ok.trainingSaved, "success");
  await loadTrainings();
}

/* =========================
   Wiring
========================= */
function bindEvents() {
  $.logoutBtn?.addEventListener("click", logout);

  // Drills
  $.drillForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      showLoader();
      await createDrillFromForm();
    } catch (err) {
      console.error(err);
      showAlert(S.errors.generic, "danger");
    } finally {
      hideLoader();
    }
  });

  $.drillSearch?.addEventListener("input", renderDrills);
  $.showArchivedSwitch?.addEventListener("change", async () => {
    try {
      showLoader();
      await loadDrills();
    } catch (err) {
      console.error(err);
      showAlert(S.errors.generic, "danger");
    } finally {
      hideLoader();
    }
  });

  $.refreshDrillsBtn?.addEventListener("click", async () => {
    try {
      showLoader();
      await loadDrills();
    } catch (err) {
      console.error(err);
      showAlert(S.errors.generic, "danger");
    } finally {
      hideLoader();
    }
  });

  $.saveDrillEditBtn?.addEventListener("click", async () => {
    if (!canEdit) return;
    try {
      showLoader();
      await saveDrillEdits();
    } catch (err) {
      console.error(err);
      showAlert(S.errors.generic, "danger");
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
    try {
      showLoader();
      await createTrainingFromForm();
    } catch (err) {
      console.error(err);
      showAlert(S.errors.generic, "danger");
    } finally {
      hideLoader();
    }
  });

  $.trainingSearch?.addEventListener("input", renderTrainingsList);

  $.refreshTrainingsBtn?.addEventListener("click", async () => {
    try {
      showLoader();
      await loadTrainings();
    } catch (err) {
      console.error(err);
      showAlert(S.errors.generic, "danger");
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
    try {
      showLoader();
      await saveTraining();
    } catch (err) {
      console.error(err);
      showAlert(S.errors.generic, "danger");
    } finally {
      hideLoader();
    }
  });
}

/* =========================
   Auth + Init
========================= */
async function resolvePermissions(user, cfg) {
  // Recommended pattern: admin can edit, others view.
  // 1) check cfg role / list
  if (isAdminByCfg(cfg)) return true;
  // 2) check custom claims (if you use them)
  if (await isAdminByClaims(user)) return true;
  return false;
}

async function init() {
  cacheDom();

  // Header + logout
  loadHeader("admin"); // o "association" si preferís el mismo layout/menú
  $.logoutBtn?.addEventListener("click", logout);

  $.pageSubtitle.textContent = S.ui.loading;

  bindEvents();

  _unsubAuth = watchAuth(async (user, cfg) => {
    // si tu watchAuth no pasa cfg, esto sigue sirviendo (cfg undefined)
    if (!user) return;

    try {
      showLoader();
      canEdit = await resolvePermissions(user, cfg);
      setRoleUI();

      $.pageSubtitle.textContent = canEdit
        ? S.ui.subtitleAdmin
        : S.ui.subtitleViewer;

      await loadDrills();
      await loadTrainings();
    } catch (err) {
      console.error(err);
      showAlert(S.errors.generic, "danger");
    } finally {
      hideLoader();
      document.body.classList.remove("loading");
    }
  });
}

init();

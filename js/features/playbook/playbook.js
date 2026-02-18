// /js/features/playbook/playbook.js
import { db } from "../../firebase.js";
import { watchAuth } from "../../auth.js";
import { showLoader, hideLoader } from "../../ui/loader.js";

import { guardPage } from "../../page-guard.js";
import { loadHeader } from "../../components/header.js";

import { CLUB_DATA } from "../../strings.js";
import { PLAYBOOK_STRINGS as S } from "../../strings/playbook_strings.js";

import { loadPartialOnce } from "../../ui/loadPartial.js";
import { createTrainingEditor } from "./training_editor.js";

import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  where,
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

let trainingEditor = null;

/* =========================
   INIT
========================= */
const { cfg, redirected } = await guardPage("playbook");
if (!redirected) {
  await loadHeader("playbook", cfg);
}

cacheDom();
bindEvents();

watchAuth(async () => {
  showLoader();
  try {
    canEdit = isAdminFromCfg(cfg);
    setRoleUI();

    $.pageSubtitle.textContent = canEdit
      ? (S.ui?.subtitleAdmin || "Admin")
      : (S.ui?.subtitleViewer || "Viewer");

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
  if (badge) badge.classList.remove("d-none");

  if (canEdit) {
    if (badge) {
      badge.className = "badge text-bg-primary";
      badge.textContent = "ADMIN (EDIT)";
    }
    $.openCreateDrillBtn?.classList.remove("d-none");
    $.openCreateTrainingBtn?.classList.remove("d-none");
  } else {
    if (badge) {
      badge.className = "badge text-bg-secondary";
      badge.textContent = "VIEW ONLY";
    }
    $.openCreateDrillBtn?.classList.add("d-none");
    $.openCreateTrainingBtn?.classList.add("d-none");
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

    // Trainings (nuevo)
    refreshTrainingsBtn: document.getElementById("refreshTrainingsBtn"),
    trainingSearch: document.getElementById("trainingSearch"),
    trainingsList: document.getElementById("trainingsList"),
    trainingsEmpty: document.getElementById("trainingsEmpty"),

    // Botón nuevo (agregalo en HTML del tab trainings)
    openCreateTrainingBtn: document.getElementById("openCreateTrainingBtn"),

    // mount para partials/modals
    modalMount: document.getElementById("modalMount"),
  };
}

/* =========================
   Alerts
========================= */
function showAlert(msg, type = "info") {
  const el = $.alertBox;
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove("d-none");
}

function clearAlert() {
  $.alertBox?.classList.add("d-none");
}

/* =========================
   Data: Drills
========================= */
async function loadDrills() {
  const showArchived = !!$.showArchivedSwitch?.checked;

  const filters = [where("clubId", "==", clubId)];
  if (!showArchived) filters.push(where("isActive", "==", true));

  const qy = query(collection(db, COL_DRILLS), ...filters);
  const snap = await getDocs(qy);

  drills = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  drills.sort((a, b) => {
    const da = a.createdAt?.toDate?.() ?? (a.createdAt ? new Date(a.createdAt) : new Date(0));
    const dbb = b.createdAt?.toDate?.() ?? (b.createdAt ? new Date(b.createdAt) : new Date(0));
    return dbb - da;
  });

  renderDrills();
}

/* =========================
   Data: Trainings (cards)
========================= */
async function loadTrainings() {
  const filters = [where("clubId", "==", clubId)];
  const qy = query(collection(db, COL_PLAYBOOK_TRAININGS), ...filters);
  const snap = await getDocs(qy);

  trainings = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // orden local por fecha desc (acepta Date o string)
  trainings.sort((a, b) => {
    const da = toDateSafe(a.date);
    const dbb = toDateSafe(b.date);
    return dbb - da;
  });

  renderTrainings();
}

/* =========================
   Render: Drills
========================= */
function renderDrills() {
  const term = norm($.drillSearch?.value);
  const filtered = term ? drills.filter(d => drillMatches(d, term)) : drills;

  if ($.drillsList) $.drillsList.innerHTML = "";

  if (!filtered.length) {
    $.drillsEmpty?.classList.remove("d-none");
    return;
  }
  $.drillsEmpty?.classList.add("d-none");

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
                ${tactical ? `<a href="${escapeHtml(tactical)}" target="_blank" rel="noopener">Tactical</a>` : `<span class="text-muted">Sin Tactical</span>`}
                <span class="mx-2">•</span>
                ${video ? `<a href="${escapeHtml(video)}" target="_blank" rel="noopener">Video</a>` : `<span class="text-muted">Sin video</span>`}
              </div>
            </div>

            <div class="text-end">
              <span class="badge ${active ? "text-bg-success" : "text-bg-secondary"}">${active ? "Activo" : "Archivado"}</span>
              ${
                canEdit
                  ? `<div class="mt-2 d-flex gap-2 justify-content-end">
                       <button class="btn btn-outline-danger btn-sm" data-action="toggle" data-id="${escapeHtml(d.id)}">
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

    $.drillsList?.appendChild(card);
  }

  if (canEdit) {
    $.drillsList?.querySelectorAll("button[data-action='toggle']").forEach(btn => {
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

function drillMatches(d, term) {
  const hay = [
    d.name, d.authorName, d.objective, d.volume, d.restAfter, d.recommendations
  ].map(norm).join(" ");
  return hay.includes(term);
}

/* =========================
   Render: Trainings (cards/list)
========================= */
function renderTrainings() {
  const term = norm($.trainingSearch?.value);
  const filtered = term
    ? trainings.filter(t => norm(t.name).includes(term))
    : trainings;

  if (!$.trainingsList) return;

  $.trainingsList.innerHTML = "";

  if (!filtered.length) {
    $.trainingsEmpty?.classList.remove("d-none");
    return;
  }
  $.trainingsEmpty?.classList.add("d-none");

  filtered.forEach(t => {
    const dateLbl = fmtDate(t.date);
    const drillCount = Array.isArray(t.drillIds) ? t.drillIds.length : (Array.isArray(t.drillRefs) ? t.drillRefs.length : 0);
    const isPublic = t.isPublic === true;

    const item = document.createElement("div");
    item.className = "list-group-item";

    const sharePath = `/training.html?id=${encodeURIComponent(t.id)}`;

    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div>
          <div class="fw-semibold">${escapeHtml(t.name || "—")}</div>
          <div class="text-muted small">${escapeHtml(dateLbl)} · ${drillCount} drill(s)</div>
          <div class="text-muted small">${isPublic ? "🌐 Público" : "🔒 Privado (solo logueados)"}</div>
        </div>

        <div class="d-flex gap-2 flex-wrap">
          ${
            isPublic
              ? `<a class="btn btn-sm btn-outline-secondary" href="${sharePath}" target="_blank" rel="noopener">Ver</a>
                 <button class="btn btn-sm btn-outline-primary" data-copy="${escapeHtml(sharePath)}">Copiar link</button>`
              : `<button class="btn btn-sm btn-outline-secondary" data-view-private="${escapeHtml(t.id)}">Ver</button>`
          }
          ${
            canEdit
              ? `<button class="btn btn-sm btn-primary" data-edit="${escapeHtml(t.id)}">Editar</button>`
              : ``
          }
        </div>
      </div>
    `;

    $.trainingsList.appendChild(item);
  });

  // copiar link (solo públicos)
  $.trainingsList.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const path = btn.getAttribute("data-copy");
      if (!path) return;
      const url = `${window.location.origin}${path}`;
      try {
        await navigator.clipboard.writeText(url);
        const old = btn.textContent;
        btn.textContent = "Copiado ✅";
        setTimeout(() => (btn.textContent = old), 1200);
      } catch {
        alert("No pude copiar. Link:\n" + url);
      }
    });
  });

  // ver privado (logueados) -> abre igual training.html, pero ahí va a bloquear si isPublic=false
  // Si querés permitir privado en training.html para signedIn, lo hacemos luego (con auth opcional).
  $.trainingsList.querySelectorAll("[data-view-private]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-view-private");
      if (!id) return;
      // por ahora lo llevamos a una vista interna (simple): abre modal de edición en read-only no lo hicimos.
      // entonces abrimos la misma vista pública, que mostrará "privado" (por diseño).
      window.open(`/training.html?id=${encodeURIComponent(id)}`, "_blank");
    });
  });

  // editar
  $.trainingsList.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-edit");
      if (!id) return;
      const ed = await ensureTrainingEditor();
      ed.openEditById(id);
    });
  });
}

/* =========================
   Training editor (modal)
========================= */
async function ensureTrainingEditor() {
  // asegurate de tener <div id="modalMount"></div> en el HTML
  await loadPartialOnce("/partials/training_editor.html", "modalMount");
  if (!trainingEditor) trainingEditor = createTrainingEditor();
  return trainingEditor;
}

/* =========================
   Drills editor (modal)
========================= */

async function ensureCreateDrillModal() {
  await loadPartialOnce("/partials/drill_create_modal.html", "modalMount");

  // re-cache de elementos del modal (porque ahora se inyecta)
  $.drillForm = document.getElementById("drillForm");
  $.drillName = document.getElementById("drillName");
  $.drillAuthor = document.getElementById("drillAuthor");
  $.drillTacticalUrl = document.getElementById("drillTacticalUrl");
  $.drillVideoUrl = document.getElementById("drillVideoUrl");
  $.drillObjective = document.getElementById("drillObjective");
  $.drillVolume = document.getElementById("drillVolume");
  $.drillRest = document.getElementById("drillRest");
  $.drillRecs = document.getElementById("drillRecs");

  $.createDrillModal = document.getElementById("createDrillModal");
  $.saveCreateDrillBtn = document.getElementById("saveCreateDrillBtn");

  // bind del botón guardar UNA sola vez (evitar doble bind)
  if (!ensureCreateDrillModal._bound) {
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
    ensureCreateDrillModal._bound = true;
  }
}

/* =========================
   CRUD: Drills
========================= */
async function createDrillFromForm() {
  clearAlert();

  const name = ($.drillName?.value || "").trim();
  const authorName = ($.drillAuthor?.value || "").trim();
  if (!name || !authorName) {
    showAlert(S.errors?.required || "Campos requeridos.", "warning");
    return;
  }

  await addDoc(collection(db, COL_DRILLS), {
    clubId,
    name,
    authorName,
    tacticalBoardUrl: safeUrl($.drillTacticalUrl?.value) || "",
    teamVideoUrl: safeUrl($.drillVideoUrl?.value) || "",
    objective: ($.drillObjective?.value || "").trim(),
    volume: ($.drillVolume?.value || "").trim(),
    restAfter: ($.drillRest?.value || "").trim(),
    recommendations: ($.drillRecs?.value || "").trim(),

    // nuevos flags
    isPublic: true,         // default
    isActive: true,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  $.drillForm?.reset?.();
  showAlert(S.ok?.drillCreated || "Drill creado.", "success");
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

  showAlert(next ? (S.ok?.drillReactivated || "Reactivado.") : (S.ok?.drillArchived || "Archivado."), "success");
  await loadDrills();
}

/* =========================
   Events
========================= */
function bindEvents() {
  // Drills
  $.openCreateDrillBtn?.addEventListener("click", async () => {
    if (!canEdit) return;
    clearAlert();
    await ensureCreateDrillModal();
    $.drillForm?.reset?.();
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
  $.trainingSearch?.addEventListener("input", renderTrainings);

  $.refreshTrainingsBtn?.addEventListener("click", async () => {
    showLoader();
    try {
      await loadTrainings();
    } finally {
      hideLoader();
    }
  });

  $.openCreateTrainingBtn?.addEventListener("click", async () => {
    if (!canEdit) return;
    const ed = await ensureTrainingEditor();
    ed.openNew();
  });

  // refrescar lista cuando modal guarda
  window.addEventListener("playbookTraining:changed", async () => {
    showLoader();
    try {
      await loadTrainings();
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
  // permite urls sin protocolo
  if (!/^https?:\/\//i.test(u)) return `https://${u}`;
  try { return new URL(u).toString(); } catch { return ""; }
}

function toDateSafe(value) {
  if (!value) return new Date(0);
  const d = value?.toDate?.() ?? (value instanceof Date ? value : new Date(value));
  return isNaN(d) ? new Date(0) : d;
}

function fmtDate(value) {
  if (!value) return "—";
  const d = toDateSafe(value);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("es-CR", { year: "numeric", month: "short", day: "2-digit" });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

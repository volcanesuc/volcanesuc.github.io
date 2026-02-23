// /js/features/playbook/gym/gym.js
// ✅ Gym tab (Playbook): lista ejercicios / rutinas / semanas + share rutina pública
// ✅ Si routine.exerciseItems trae null en sets/reps/rest/distance -> usa defaults del gym_exercises
//
// Requiere en HTML (tu tab Gym):
// - #refreshGymBtn
// - #gymExerciseSearch, #gymExercisesList, #gymExercisesEmpty
// - #gymRoutineSearch, #gymRoutinesList, #gymRoutinesEmpty
// - #gymWeekSearch, #gymWeeksList, #gymWeeksEmpty
//
// Botones admin (opcional):
// - #openCreateGymExerciseBtn, #openCreateGymRoutineBtn, #openCreateGymWeekBtn
//
// Importante:
// - Este módulo NO crea/edita (eso lo tenés en tus modales).
// - Solo lista y agrega share public + copy link, y expone helper para "resolved items".

import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   Collections (reales)
========================= */
const COL_EXERCISES = "gym_exercises";
const COL_ROUTINES = "gym_routines";
const COL_WEEKS = "gym_weeks"; // si no existe, igual no revienta (maneja vacío)

/* =========================
   State
========================= */
let $ = {};
let _ctx = {
  db: null,
  clubId: "volcanes",
  canEdit: false,
};

let exercises = [];
let routines = [];
let weeks = [];

/* =========================
   Public API
========================= */
export async function initGymTab({ db, clubId, canEdit, modalMountId }) {
  _ctx = { db, clubId, canEdit };

  cacheDom();
  bindEvents();

  // show/hide admin CTAs
  toggleAdminButtons(canEdit);

  // initial load
  await refreshAll();
}

/* =========================
   DOM
========================= */
function cacheDom() {
  $ = {
    refreshGymBtn: document.getElementById("refreshGymBtn"),

    // Exercises
    gymExerciseSearch: document.getElementById("gymExerciseSearch"),
    gymExercisesList: document.getElementById("gymExercisesList"),
    gymExercisesEmpty: document.getElementById("gymExercisesEmpty"),

    // Routines
    gymRoutineSearch: document.getElementById("gymRoutineSearch"),
    gymRoutinesList: document.getElementById("gymRoutinesList"),
    gymRoutinesEmpty: document.getElementById("gymRoutinesEmpty"),

    // Weeks
    gymWeekSearch: document.getElementById("gymWeekSearch"),
    gymWeeksList: document.getElementById("gymWeeksList"),
    gymWeeksEmpty: document.getElementById("gymWeeksEmpty"),

    // Admin CTAs (optional)
    openCreateGymExerciseBtn: document.getElementById("openCreateGymExerciseBtn"),
    openCreateGymRoutineBtn: document.getElementById("openCreateGymRoutineBtn"),
    openCreateGymWeekBtn: document.getElementById("openCreateGymWeekBtn"),
  };
}

function toggleAdminButtons(canEdit) {
  // si no existen, no pasa nada
  if (canEdit) {
    $.openCreateGymExerciseBtn?.classList.remove("d-none");
    $.openCreateGymRoutineBtn?.classList.remove("d-none");
    $.openCreateGymWeekBtn?.classList.remove("d-none");
  } else {
    $.openCreateGymExerciseBtn?.classList.add("d-none");
    $.openCreateGymRoutineBtn?.classList.add("d-none");
    $.openCreateGymWeekBtn?.classList.add("d-none");
  }
}

/* =========================
   Events
========================= */
function bindEvents() {
  // refresh all
  $.refreshGymBtn?.addEventListener("click", refreshAll);

  // search inputs
  $.gymExerciseSearch?.addEventListener("input", renderExercises);
  $.gymRoutineSearch?.addEventListener("input", renderRoutines);
  $.gymWeekSearch?.addEventListener("input", renderWeeks);

  // listeners externos (si tus modales disparan eventos)
  window.addEventListener("gym:changed", refreshAll);
  window.addEventListener("gym:routinesChanged", loadRoutinesAndRender);
  window.addEventListener("gym:exercisesChanged", loadExercisesAndRender);
  window.addEventListener("gym:weeksChanged", loadWeeksAndRender);

  // Admin CTAs: disparar eventos para que el "editor" abra modales
 $.openCreateGymExerciseBtn?.addEventListener("click", () => {
  if (!_ctx.canEdit) return;
    window.dispatchEvent(new CustomEvent("gym:exercise:new"));
 });

 $.openCreateGymRoutineBtn?.addEventListener("click", () => {
    if (!_ctx.canEdit) return;
    window.dispatchEvent(new CustomEvent("gym:routine:new"));
 });

 $.openCreateGymWeekBtn?.addEventListener("click", () => {
    if (!_ctx.canEdit) return;
    window.dispatchEvent(new CustomEvent("gym:week:new"));
 });
}

/* =========================
   Loaders
========================= */
async function refreshAll() {
  await Promise.all([
    loadExercises(),
    loadRoutines(),
    loadWeeks(),
  ]);
  renderExercises();
  renderRoutines();
  renderWeeks();
}

async function loadExercises() {
  if (!_ctx.db) return;
  const qy = query(
    collection(_ctx.db, COL_EXERCISES),
    where("clubId", "==", _ctx.clubId)
  );
  const snap = await getDocs(qy);
  exercises = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(x => x.isActive !== false);

  exercises.sort((a, b) => norm(a.name).localeCompare(norm(b.name)));
}

async function loadRoutines() {
  if (!_ctx.db) return;
  const qy = query(
    collection(_ctx.db, COL_ROUTINES),
    where("clubId", "==", _ctx.clubId)
  );
  const snap = await getDocs(qy);
  routines = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(x => x.isActive !== false);

  // newest first
  routines.sort((a, b) => toDateSafe(b.updatedAt) - toDateSafe(a.updatedAt));
}

async function loadWeeks() {
  // si no existe la colección, Firestore igual responde vacío si no hay docs
  if (!_ctx.db) return;
  const qy = query(
    collection(_ctx.db, COL_WEEKS),
    where("clubId", "==", _ctx.clubId)
  );
  const snap = await getDocs(qy);
  weeks = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(x => x.isActive !== false);

  weeks.sort((a, b) => toDateSafe(b.updatedAt) - toDateSafe(a.updatedAt));
}

async function loadExercisesAndRender() {
  await loadExercises();
  renderExercises();
}

async function loadRoutinesAndRender() {
  await loadRoutines();
  renderRoutines();
}

async function loadWeeksAndRender() {
  await loadWeeks();
  renderWeeks();
}

/* =========================
   Render: Exercises
========================= */
function renderExercises() {
  if (!$.gymExercisesList) return;

  const term = norm($.gymExerciseSearch?.value);
  const filtered = term
    ? exercises.filter(e => norm(e.name).includes(term))
    : exercises;

  $.gymExercisesList.innerHTML = "";

  if (!filtered.length) {
    $.gymExercisesEmpty?.classList.remove("d-none");
    return;
  }
  $.gymExercisesEmpty?.classList.add("d-none");

  for (const ex of filtered) {
    const item = document.createElement("div");
    item.className = "list-group-item";

    // clickable para editar (solo admin)
    const clickable = _ctx.canEdit
      ? `data-edit-exercise="${escapeHtml(ex.id)}" style="cursor:pointer"`
      : "";

    item.innerHTML = `
      <div class="d-flex justify-content-between gap-2 flex-wrap" ${clickable}>
        <div>
          <div class="fw-semibold">${escapeHtml(ex.name || "—")}</div>
          <div class="text-muted small">
            ${fmtExerciseDefaults(ex)}
          </div>
          ${ex.notes ? `<div class="small mt-1">${escapeHtml(ex.notes)}</div>` : ``}
        </div>

        <div class="d-flex gap-2 align-items-start flex-wrap">
          ${ex.videoUrl ? `<a class="btn btn-sm btn-outline-secondary" href="${escapeHtml(ex.videoUrl)}" target="_blank" rel="noopener">Video</a>` : ``}

          ${
            _ctx.canEdit
              ? `<button class="btn btn-sm btn-primary" data-edit-exercise-btn="${escapeHtml(ex.id)}">Editar</button>`
              : ``
          }
        </div>
      </div>
    `;

    $.gymExercisesList.appendChild(item);
  }

  // bind edit handlers
  bindExerciseButtons();
}

function bindExerciseButtons() {
  if (!_ctx.canEdit) return;

  // 1) click en botón "Editar"
  $.gymExercisesList?.querySelectorAll("[data-edit-exercise-btn]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-edit-exercise-btn");
      if (!id) return;
      openExerciseEditor(id);
    });
  });

  // 2) click en la card (pero ignorando links/botones)
  $.gymExercisesList?.querySelectorAll("[data-edit-exercise]").forEach(row => {
    row.addEventListener("click", (e) => {
      const target = e.target;
      if (target?.closest("a,button")) return;

      const id = row.getAttribute("data-edit-exercise");
      if (!id) return;
      openExerciseEditor(id);
    });
  });
}

function openExerciseEditor(id) {
  if (!_ctx.canEdit) return;
  window.dispatchEvent(new CustomEvent("gym:exercise:edit", { detail: { id } }));
  console.log("[gym] edit exercise requested:", id);
}

function fmtExerciseDefaults(ex) {
  // seriesType: "reps" o "distance" (según tu doc)
  const st = (ex.seriesType || "reps").toString();
  const parts = [];

  if (st === "distance") {
    parts.push(`Distancia: ${escapeHtml(ex.distance ?? "—")} ${escapeHtml(ex.distanceUnit ?? "")}`.trim());
  } else {
    parts.push(`Sets: ${escapeHtml(ex.sets ?? "—")}`);
    parts.push(`Reps: ${escapeHtml(ex.reps ?? "—")}`);
  }

  if (ex.restSec !== null && ex.restSec !== undefined) {
    parts.push(`Descanso: ${escapeHtml(ex.restSec)}s`);
  }

  return parts.join(" · ");
}

/* =========================
   Render: Routines + Share
========================= */
function renderRoutines() {
  if (!$.gymRoutinesList) return;

  const term = norm($.gymRoutineSearch?.value);
  const filtered = term
    ? routines.filter(r => norm(r.name).includes(term))
    : routines;

  $.gymRoutinesList.innerHTML = "";

  if (!filtered.length) {
    $.gymRoutinesEmpty?.classList.remove("d-none");
    return;
  }
  $.gymRoutinesEmpty?.classList.add("d-none");

  for (const r of filtered) {
    const isPublic = r.isPublic === true;

    const row = document.createElement("div");
    row.className = "list-group-item";

    row.innerHTML = `
      <div class="d-flex justify-content-between gap-2 flex-wrap">
        <div>
          <div class="fw-semibold">${escapeHtml(r.name || "—")}</div>
          <div class="text-muted small">${isPublic ? "🌐 Pública" : "🔒 Privada"}</div>
          ${r.description ? `<div class="small mt-1">${escapeHtml(r.description)}</div>` : ``}
        </div>

        <div class="d-flex gap-2 flex-wrap">
          ${
            isPublic
              ? `
                <a class="btn btn-sm btn-outline-secondary" href="${routineSharePath(r.id)}" target="_blank" rel="noopener">Ver</a>
                <button class="btn btn-sm btn-outline-primary" data-copy-routine="${escapeHtml(r.id)}">Copiar link</button>
              `
              : `
                ${_ctx.canEdit ? `<button class="btn btn-sm btn-outline-primary" data-make-public="${escapeHtml(r.id)}">Hacer pública</button>` : ``}
              `
          }

          <button class="btn btn-sm btn-outline-secondary" data-preview-routine="${escapeHtml(r.id)}">Preview</button>

          ${
            _ctx.canEdit
              ? `<button class="btn btn-sm btn-primary" data-edit-routine="${escapeHtml(r.id)}">Editar</button>`
              : ``
          }
        </div>
      </div>

      <div class="mt-2 d-none" id="routinePreview_${escapeHtml(r.id)}"></div>
    `;

    $.gymRoutinesList.appendChild(row);
  }

  bindRoutineButtons();
}

function bindRoutineButtons() {
  // copiar link
  $.gymRoutinesList?.querySelectorAll("[data-copy-routine]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-copy-routine");
      if (!id) return;
      try {
        await copyRoutineLink(id);
        const old = btn.textContent;
        btn.textContent = "Copiado ✅";
        setTimeout(() => (btn.textContent = old), 1200);
      } catch (e) {
        console.error(e);
        alert("No pude copiar el link.");
      }
    });
  });

  // hacer pública
  $.gymRoutinesList?.querySelectorAll("[data-make-public]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-make-public");
      if (!id) return;
      if (!_ctx.canEdit) return;

      btn.disabled = true;
      try {
        await updateDoc(doc(_ctx.db, COL_ROUTINES, id), {
          isPublic: true,
          updatedAt: serverTimestamp(),
        });
        await loadRoutinesAndRender();
      } catch (e) {
        console.error(e);
        alert("Error haciendo la rutina pública.");
      } finally {
        btn.disabled = false;
      }
    });
  });

  // preview (resuelto con defaults)
  $.gymRoutinesList?.querySelectorAll("[data-preview-routine]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-preview-routine");
      if (!id) return;

      const box = document.getElementById(`routinePreview_${id}`);
      if (!box) return;

      // toggle
      const isHidden = box.classList.contains("d-none");
      if (!isHidden) {
        box.classList.add("d-none");
        box.innerHTML = "";
        return;
      }

      try {
        box.classList.remove("d-none");
        box.innerHTML = `<div class="text-muted small">Cargando preview…</div>`;

        const { routine, resolvedItems } = await loadRoutineResolved({ db: _ctx.db, routineId: id });
        box.innerHTML = renderRoutinePreview(routine, resolvedItems);
      } catch (e) {
        console.error(e);
        box.innerHTML = `<div class="text-danger small">Error cargando preview.</div>`;
      }
    });
  });

  // editar: lo dejás conectado a tu modal/editor (si ya lo tenés)
  $.gymRoutinesList?.querySelectorAll("[data-edit-routine]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-routine");
      if (!id) return;
      // 🔧 Acá conectás tu editor real:
      // window.dispatchEvent(new CustomEvent("gym:editRoutine", { detail: { id } }));
      console.log("[gym] edit routine:", id);
    });
  });
}

function renderRoutinePreview(routine, items) {
  const rows = items.map(it => `
    <div class="border rounded p-2 mb-2">
      <div class="fw-semibold">${escapeHtml(it.order)}. ${escapeHtml(it.name)}</div>
      <div class="text-muted small">${escapeHtml(fmtItemSeries(it))}</div>
      ${it.notes ? `<div class="small mt-1">${escapeHtml(it.notes)}</div>` : ``}
      ${it.videoUrl ? `<a class="small" href="${escapeHtml(it.videoUrl)}" target="_blank" rel="noopener">Video</a>` : ``}
    </div>
  `).join("");

  return `
    <div class="mt-2">
      <div class="text-muted small mb-2">
        Preview usando defaults del ejercicio cuando el item trae null.
      </div>
      ${rows || `<div class="text-muted small">Sin ejercicios.</div>`}
    </div>
  `;
}

/* =========================
   Resolver: routine.exerciseItems + defaults from gym_exercises
========================= */
export async function loadRoutineResolved({ db, routineId }) {
  const rSnap = await getDoc(doc(db, COL_ROUTINES, routineId));
  if (!rSnap.exists()) throw new Error("Rutina no existe");

  const routine = { id: rSnap.id, ...rSnap.data() };

  const items = Array.isArray(routine.exerciseItems) ? routine.exerciseItems.slice() : [];
  items.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

  const exerciseSnaps = await Promise.all(
    items.map(it => it?.exerciseId ? getDoc(doc(db, COL_EXERCISES, it.exerciseId)) : Promise.resolve(null))
  );

  const resolvedItems = items.map((it, idx) => {
    const exSnap = exerciseSnaps[idx];
    const ex = exSnap && exSnap.exists() ? { id: exSnap.id, ...exSnap.data() } : null;

    const pick = (overrideVal, baseVal) =>
      (overrideVal === null || overrideVal === undefined) ? baseVal : overrideVal;

    const pickNotes = (overrideNotes, baseNotes) => {
      const o = (overrideNotes ?? "").toString().trim();
      if (o) return o;
      return (baseNotes ?? "").toString().trim();
    };

    return {
      order: it.order ?? (idx + 1),
      exerciseId: it.exerciseId || null,

      name: ex?.name || "—",
      videoUrl: ex?.videoUrl || "",
      bodyParts: ex?.bodyParts || [],

      // series fields: si item trae null -> defaults del exercise
      seriesType: pick(it.seriesType, ex?.seriesType ?? "reps"),
      sets: pick(it.sets, ex?.sets ?? null),
      reps: pick(it.reps, ex?.reps ?? null),
      restSec: pick(it.restSec, ex?.restSec ?? null),
      distance: pick(it.distance, ex?.distance ?? null),
      distanceUnit: pick(it.distanceUnit, ex?.distanceUnit ?? null),

      // notes: si item.notes == "" usa ex.notes
      notes: pickNotes(it.notes, ex?.notes),

      _exerciseMissing: !ex,
    };
  });

  return { routine, resolvedItems };
}

function fmtItemSeries(it) {
  const parts = [];
  const st = (it.seriesType || "reps").toString();

  if (st === "distance") {
    parts.push(`Distancia: ${it.distance ?? "—"} ${it.distanceUnit ?? ""}`.trim());
  } else {
    parts.push(`Sets: ${it.sets ?? "—"}`);
    parts.push(`Reps: ${it.reps ?? "—"}`);
  }

  if (it.restSec !== null && it.restSec !== undefined) {
    parts.push(`Descanso: ${it.restSec}s`);
  }

  return parts.join(" · ");
}

/* =========================
   Render: Weeks (simple placeholder)
========================= */
function renderWeeks() {
  if (!$.gymWeeksList) return;

  const term = norm($.gymWeekSearch?.value);
  const filtered = term
    ? weeks.filter(w => norm(w.name).includes(term))
    : weeks;

  $.gymWeeksList.innerHTML = "";

  if (!filtered.length) {
    $.gymWeeksEmpty?.classList.remove("d-none");
    return;
  }
  $.gymWeeksEmpty?.classList.add("d-none");

  for (const w of filtered) {
    const item = document.createElement("div");
    item.className = "list-group-item";

    item.innerHTML = `
      <div class="d-flex justify-content-between gap-2 flex-wrap">
        <div>
          <div class="fw-semibold">${escapeHtml(w.name || "—")}</div>
          <div class="text-muted small">${escapeHtml(w.description || "")}</div>
        </div>
        <div class="d-flex gap-2">
          ${_ctx.canEdit ? `<button class="btn btn-sm btn-primary" data-edit-week="${escapeHtml(w.id)}">Editar</button>` : ``}
        </div>
      </div>
    `;

    $.gymWeeksList.appendChild(item);
  }
}

/* =========================
   Share helpers
========================= */
function routineSharePath(id) {
  return `/gym_routine.html?id=${encodeURIComponent(id)}`;
}

async function copyRoutineLink(routineId) {
  const url = `${window.location.origin}${routineSharePath(routineId)}`;
  await navigator.clipboard.writeText(url);
  return url;
}

/* =========================
   Utils
========================= */
function norm(s) {
  return (s || "").toString().toLowerCase().trim();
}

function toDateSafe(v) {
  const d = v?.toDate?.() ?? (v instanceof Date ? v : new Date(v || 0));
  return isNaN(d) ? new Date(0) : d;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
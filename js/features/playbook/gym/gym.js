import { loadPartialOnce } from "../../../ui/loadPartial.js";
import {
  collection, getDocs, addDoc, doc, setDoc, updateDoc,
  serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const COL_EX = "gym_exercises";
const COL_ROUT = "gym_routines";
const COL_WEEK = "gym_weeks";

let state = {
  db: null,
  clubId: "volcanes",
  canEdit: false,
  $: {},
  exercises: [],
  routines: [],
  weeks: []
};

export async function initGymTab({ db, clubId, canEdit, modalMountId = "modalMount" }) {
  state.db = db;
  state.clubId = clubId;
  state.canEdit = !!canEdit;

  cacheDom(modalMountId);
  bindGymEvents();

  await loadGymAll();
  renderGymAll();
}

function cacheDom(modalMountId) {
  state.$ = {
    refreshGymBtn: document.getElementById("refreshGymBtn"),

    openCreateGymExerciseBtn: document.getElementById("openCreateGymExerciseBtn"),
    openCreateGymRoutineBtn: document.getElementById("openCreateGymRoutineBtn"),
    openCreateGymWeekBtn: document.getElementById("openCreateGymWeekBtn"),

    gymExerciseSearch: document.getElementById("gymExerciseSearch"),
    gymRoutineSearch: document.getElementById("gymRoutineSearch"),
    gymWeekSearch: document.getElementById("gymWeekSearch"),

    gymExercisesList: document.getElementById("gymExercisesList"),
    gymRoutinesList: document.getElementById("gymRoutinesList"),
    gymWeeksList: document.getElementById("gymWeeksList"),

    gymExercisesEmpty: document.getElementById("gymExercisesEmpty"),
    gymRoutinesEmpty: document.getElementById("gymRoutinesEmpty"),
    gymWeeksEmpty: document.getElementById("gymWeeksEmpty"),

    modalMount: document.getElementById(modalMountId),
  };

  // permisos UI
  if (state.canEdit) {
    state.$.openCreateGymExerciseBtn?.classList.remove("d-none");
    state.$.openCreateGymRoutineBtn?.classList.remove("d-none");
    state.$.openCreateGymWeekBtn?.classList.remove("d-none");
  } else {
    state.$.openCreateGymExerciseBtn?.classList.add("d-none");
    state.$.openCreateGymRoutineBtn?.classList.add("d-none");
    state.$.openCreateGymWeekBtn?.classList.add("d-none");
  }
}

function bindGymEvents() {
  state.$.refreshGymBtn?.addEventListener("click", async () => {
    await loadGymAll();
    renderGymAll();
  });

  state.$.gymExerciseSearch?.addEventListener("input", renderExercises);
  state.$.gymRoutineSearch?.addEventListener("input", renderRoutines);
  state.$.gymWeekSearch?.addEventListener("input", renderWeeks);

  state.$.openCreateGymExerciseBtn?.addEventListener("click", async () => {
    if (!state.canEdit) return;
    await openExerciseModal();
  });

  state.$.openCreateGymRoutineBtn?.addEventListener("click", async () => {
    if (!state.canEdit) return;
    await openRoutineEditor();
  });

  state.$.openCreateGymWeekBtn?.addEventListener("click", async () => {
    if (!state.canEdit) return;
    await openWeekEditor();
  });
}

async function loadGymAll() {
  await Promise.all([loadExercises(), loadRoutines(), loadWeeks()]);
}

async function loadExercises() {
  const qy = query(
    collection(state.db, COL_EX),
    where("clubId", "==", state.clubId),
    where("isActive", "==", true)
  );
  const snap = await getDocs(qy);
  state.exercises = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  state.exercises.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

async function loadRoutines() {
  const qy = query(
    collection(state.db, COL_ROUT),
    where("clubId", "==", state.clubId),
    where("isActive", "==", true)
  );
  const snap = await getDocs(qy);
  state.routines = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  state.routines.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

async function loadWeeks() {
  const qy = query(
    collection(state.db, COL_WEEK),
    where("clubId", "==", state.clubId),
    where("isActive", "==", true)
  );
  const snap = await getDocs(qy);
  state.weeks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  state.weeks.sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
}

function renderGymAll() {
  renderExercises();
  renderRoutines();
  renderWeeks();
}

/* -------------------------
  Render: Exercises
-------------------------- */
function renderExercises() {
  const term = norm(state.$.gymExerciseSearch?.value);
  const list = term
    ? state.exercises.filter(x => norm(x.name).includes(term))
    : state.exercises;

  if (!state.$.gymExercisesList) return;
  state.$.gymExercisesList.innerHTML = "";

  if (!list.length) {
    state.$.gymExercisesEmpty?.classList.remove("d-none");
    return;
  }
  state.$.gymExercisesEmpty?.classList.add("d-none");

  list.forEach(ex => {
    const item = document.createElement("div");
    item.className = "list-group-item";

    const parts = Array.isArray(ex.bodyParts) ? ex.bodyParts.join(", ") : "—";
    const hasVideo = !!(ex.videoUrl || "").trim();

    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <div class="fw-semibold">${escapeHtml(ex.name || "—")}</div>
          <div class="text-muted small">${escapeHtml(parts)}</div>
        </div>
        <div class="d-flex gap-2">
          ${hasVideo ? `<a class="btn btn-sm btn-outline-secondary" href="${escapeHtml(ex.videoUrl)}" target="_blank" rel="noopener">Video</a>` : ``}
          ${state.canEdit ? `<button class="btn btn-sm btn-primary" data-edit-ex="${escapeHtml(ex.id)}">Editar</button>` : ``}
        </div>
      </div>
    `;

    state.$.gymExercisesList.appendChild(item);
  });

  if (state.canEdit) {
    state.$.gymExercisesList.querySelectorAll("[data-edit-ex]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-edit-ex");
        if (!id) return;
        await openExerciseModal(id);
      });
    });
  }
}

/* -------------------------
  Render: Routines
-------------------------- */
function renderRoutines() {
  const term = norm(state.$.gymRoutineSearch?.value);
  const list = term
    ? state.routines.filter(x => norm(x.name).includes(term))
    : state.routines;

  if (!state.$.gymRoutinesList) return;
  state.$.gymRoutinesList.innerHTML = "";

  if (!list.length) {
    state.$.gymRoutinesEmpty?.classList.remove("d-none");
    return;
  }
  state.$.gymRoutinesEmpty?.classList.add("d-none");

  list.forEach(r => {
    const count = Array.isArray(r.exerciseItems) ? r.exerciseItems.length : 0;
    const isPublic = r.isPublic === true;

    const item = document.createElement("div");
    item.className = "list-group-item";

    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div>
          <div class="fw-semibold">${escapeHtml(r.name || "—")}</div>
          <div class="text-muted small">${count} ejercicio(s) · ${isPublic ? "🌐 Público" : "🔒 Privado"}</div>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          ${state.canEdit ? `<button class="btn btn-sm btn-primary" data-edit-r="${escapeHtml(r.id)}">Editar</button>` : ``}
        </div>
      </div>
    `;

    state.$.gymRoutinesList.appendChild(item);
  });

  if (state.canEdit) {
    state.$.gymRoutinesList.querySelectorAll("[data-edit-r]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-edit-r");
        if (!id) return;
        await openRoutineEditor(id);
      });
    });
  }
}

/* -------------------------
  Render: Weeks (share link)
-------------------------- */
function renderWeeks() {
  const term = norm(state.$.gymWeekSearch?.value);
  const list = term
    ? state.weeks.filter(x => norm(x.name).includes(term))
    : state.weeks;

  if (!state.$.gymWeeksList) return;
  state.$.gymWeeksList.innerHTML = "";

  if (!list.length) {
    state.$.gymWeeksEmpty?.classList.remove("d-none");
    return;
  }
  state.$.gymWeeksEmpty?.classList.add("d-none");

  list.forEach(w => {
    const slotCount = Array.isArray(w.slots) ? w.slots.length : 0;
    const sharePath = `/gym_week.html?id=${encodeURIComponent(w.id)}`;
    const isPublic = w.isPublic === true;

    const item = document.createElement("div");
    item.className = "list-group-item";

    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div>
          <div class="fw-semibold">${escapeHtml(w.name || "—")}</div>
          <div class="text-muted small">${escapeHtml(w.startDate || "—")} → ${escapeHtml(w.endDate || "—")} · ${slotCount} rutina(s)</div>
          <div class="text-muted small">${isPublic ? "🌐 Compartible" : "🔒 Privado"}</div>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          ${isPublic ? `<a class="btn btn-sm btn-outline-secondary" href="${sharePath}" target="_blank" rel="noopener">Ver</a>` : ``}
          ${isPublic ? `<button class="btn btn-sm btn-outline-primary" data-copy-week="${escapeHtml(sharePath)}">Copiar link</button>` : ``}
          ${state.canEdit ? `<button class="btn btn-sm btn-primary" data-edit-w="${escapeHtml(w.id)}">Editar</button>` : ``}
        </div>
      </div>
    `;

    state.$.gymWeeksList.appendChild(item);
  });

  // copy
  state.$.gymWeeksList.querySelectorAll("[data-copy-week]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const path = btn.getAttribute("data-copy-week");
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

  if (state.canEdit) {
    state.$.gymWeeksList.querySelectorAll("[data-edit-w]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-edit-w");
        if (!id) return;
        await openWeekEditor(id);
      });
    });
  }
}

/* -------------------------
  Editors (MVP simple)
  - Aquí lo dejé como placeholder: abre modal/partial
  - Te hago los partials después, pero ya queda el esqueleto
-------------------------- */

async function openExerciseModal(editId = null) {
  await loadPartialOnce("/partials/gym_exercise_modal.html", "modalMount");
  // aquí: bind fields + save (addDoc / setDoc)
  // dispará event para recargar:
  // window.dispatchEvent(new CustomEvent("gym:changed"));
  alert("TODO: modal ejercicio. Ya está listo el hook.");
}

async function openRoutineEditor(editId = null) {
  await loadPartialOnce("/partials/gym_routine_editor.html", "modalMount");
  alert("TODO: editor rutina (agregar ejercicios). Ya está listo el hook.");
}

async function openWeekEditor(editId = null) {
  await loadPartialOnce("/partials/gym_week_editor.html", "modalMount");
  alert("TODO: editor semana (asignar rutinas). Ya está listo el hook.");
}

/* utils */
function norm(s) { return (s || "").toString().toLowerCase().trim(); }
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}